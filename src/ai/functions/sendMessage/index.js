import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Anthropic from "@anthropic-ai/sdk";

const tools = [
  {
    name: "github_search",
    description: "Search code and issues in a repo.",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name" },
        q: { type: "string", description: "search query" },
        type: { type: "string", enum: ["code", "issues", "commits"], default: "code" },
      },
      required: ["repo", "q"],
    },
  },
  {
    name: "github_get_file",
    description: "Fetch exact lines from a snippet of a file at a ref. Only request snippets of 1500-2000 lines at a time",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        ref: { type: "string", description: "branch or commit SHA" },
        path: { type: "string" },
        start: { type: "integer" },
        end: { type: "integer" },
      },
      required: ["repo", "ref", "path"],
    },
  },
];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const WS_CONNECTIONS_TABLE = process.env.WS_CONNECTIONS_TABLE;
const SESSION_USAGE_TABLE = process.env.SESSION_USAGE_TABLE || "KoltBotSessionUsage";
const SESSION_WINDOW_SECONDS = 3 * 60 * 60; // 3 hours
const SESSION_TOKEN_LIMIT = 50000;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getSessionUsage(sessionId) {
  if (!SESSION_USAGE_TABLE) {
    console.warn("SESSION_USAGE_TABLE not set, skipping usage check");
    return 0;
  }
  try {
    const result = await ddb.send(new GetCommand({
      TableName: SESSION_USAGE_TABLE,
      Key: { sessionId },
    }));
    const now = Math.floor(Date.now() / 1000);
    // If windowStart is stale (older than SESSION_WINDOW_SECONDS), treat usage as 0
    if (result.Item?.windowStart && (now - result.Item.windowStart) > SESSION_WINDOW_SECONDS) {
      return 0;
    }
    return result.Item?.tokensUsed || 0;
  } catch (err) {
    console.error("Error getting session usage:", err);
    return 0; // Fail open - don't block if usage check fails
  }
}

async function addSessionUsage(sessionId, tokensToAdd) {
  if (!SESSION_USAGE_TABLE) {
    console.warn("SESSION_USAGE_TABLE not set, skipping usage update");
    return 0;
  }
  try {
    const now = Math.floor(Date.now() / 1000);
    const ttl = now + SESSION_WINDOW_SECONDS;

    // First get current record to check if we need to reset window
    const current = await ddb.send(new GetCommand({
      TableName: SESSION_USAGE_TABLE,
      Key: { sessionId },
    }));

    const windowStart = current.Item?.windowStart || now;
    const windowExpired = (now - windowStart) > SESSION_WINDOW_SECONDS;

    if (windowExpired || !current.Item) {
      // Start a new window
      await ddb.send(new UpdateCommand({
        TableName: SESSION_USAGE_TABLE,
        Key: { sessionId },
        UpdateExpression: "SET tokensUsed = :tokens, windowStart = :now, lastSeen = :now, #ttl = :ttl",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":tokens": tokensToAdd,
          ":now": now,
          ":ttl": ttl,
        },
      }));
      return tokensToAdd;
    } else {
      // Add to existing window
      await ddb.send(new UpdateCommand({
        TableName: SESSION_USAGE_TABLE,
        Key: { sessionId },
        UpdateExpression: "SET tokensUsed = tokensUsed + :tokens, lastSeen = :now, #ttl = :ttl",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":tokens": tokensToAdd,
          ":now": now,
          ":ttl": ttl,
        },
      }));
      return (current.Item?.tokensUsed || 0) + tokensToAdd;
    }
  } catch (err) {
    console.error("Error updating session usage:", err);
    return 0; // Fail open
  }
}

function agClient(event) {
  const { domainName, stage } = event.requestContext;
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
}

async function send(client, connectionId, data) {
  const Data = Buffer.from(typeof data === "string" ? data : JSON.stringify(data));
  try {
    await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data }));
  } catch (err) {
    if (err?.name === "GoneException") {
      console.log("WS gone:", connectionId);
    } else {
      console.error("PostToConnection error:", err);
    }
  }
}

function wireStream(stream, client, connectionId) {
  let seq = 0; // Monotonic sequence number per stream

  const sendWithSeq = async (payload) => {
    const enriched = { ...payload, seq: seq++, ts: Date.now() };
    await send(client, connectionId, enriched);
  };

  stream.on("text", async (t) => {
    await sendWithSeq({ type: "delta", text: t });
  });

  stream.on("event", async (ev) => {
    console.log("Stream event:", ev.type, ev);
  });

  stream.on("error", async (err) => {
    await sendWithSeq({ type: "error", message: String(err?.message || err) });
  });

  return sendWithSeq;
}

async function handleFinalMessage(message, client, connectionId, sendWithSeq, onUsage) {
  console.log("Final message received:", JSON.stringify(message, null, 2));
  
  // Record usage if callback provided
  if (message?.usage && onUsage) {
    try {
      await onUsage(message.usage);
    } catch (err) {
      console.error("Error recording usage:", err);
    }
  }
  
  // Check for tool_use in the final message content
  if (message?.content) {
    for (const block of message.content) {
      if (block.type === "tool_use") {
        console.log("Sending tool_use from final message:", block);
        await sendWithSeq({ 
          type: "tool_use", 
          id: block.id, 
          name: block.name, 
          input: block.input 
        });
        return; // Don't send "done" yet - wait for tool result
      }
    }
  }
  
  // Only send "done" if no tool_use was found
  await sendWithSeq({ type: "done" });
}

function trimHistory(history, maxTurns = 12) {
  if (!Array.isArray(history)) return [];
  return history.length > maxTurns ? history.slice(-maxTurns) : history;
}

export const handler = async (event) => {
  const client = agClient(event);
  const connectionId = event.requestContext.connectionId;
  const now = Math.floor(Date.now() / 1000);

  const connection = await ddb.send(new GetCommand({
    TableName: WS_CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  const sessionId = connection.Item?.sessionId;
  if (!sessionId) {
    await send(client, connectionId, { type: "error", message: "No session associated with connection" });
    return { statusCode: 400, error: "No session associated with connection" };
  }

  // Check token limit before processing
  const currentUsage = await getSessionUsage(sessionId);
  if (currentUsage >= SESSION_TOKEN_LIMIT) {
    await send(client, connectionId, {
      type: "error",
      code: "TOKEN_LIMIT_EXCEEDED",
      message: `Session token limit exceeded (${currentUsage}/${SESSION_TOKEN_LIMIT}). Please try again later.`,
    });
    return { statusCode: 429, error: "Token limit exceeded" };
  }

  // Callback to record usage after each message
  const onUsage = async (usage) => {
    const { input_tokens, output_tokens } = usage;
    const tokensUsed = input_tokens + output_tokens;
    const newTotal = await addSessionUsage(sessionId, tokensUsed);
    console.log(`Session ${sessionId}: added ${tokensUsed} tokens (in:${input_tokens}, out:${output_tokens}), total now ${newTotal}`);
    // Notify client of usage
    await send(client, connectionId, {
      type: "usage",
      input_tokens,
      output_tokens,
      session_total: newTotal,
      session_limit: SESSION_TOKEN_LIMIT,
    });
  };


  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {}

  const model = payload.model || "claude-sonnet-4-5-20250929";
  const system =
    payload.system ||
      `You answer questions about Colton and his projects: "course-notifier" and "portfolio-website". GitHub username: ColtonFRSTT.

      Default behavior:
      - When asked about a project, perform ONE github_search to locate the repository.
      - Then retrieve ONLY the README (or top-level project documentation) using ONE github_file request.
      - Summarize from that.

      Do NOT search or open additional files unless the user explicitly asks for implementation details such as:
      “show code”, “how is this implemented”, “open the file”, “search the repo”, “look at handler”, etc.

      Never recursively inspect directories or fetch multiple files unless the user requests it.
      If unsure, ask the user what level of detail they want.

      Be concise. If information is not in the README or requested files, say you don’t know.
      `;
  const history = trimHistory(payload.history, 12);

  // Resume after tool execution
  if (payload.type === "tool_result") {

  // ack with seq from a new counter for this flow
  await send(client, connectionId, { type: "ack", tool_use_id: payload.tool_use_id, ts: Date.now() });

    console.log("Processing tool_result payload:", JSON.stringify(payload, null, 2));
    console.log("History length:", payload.history?.length);
    console.log("Tool result content length:", payload.content?.length);
    console.log("Tool result content:", payload.content);

    // Validate the history format
    if (!Array.isArray(payload.history)) {
      console.error("Invalid history format - not an array");
      await send(client, connectionId, { type: "error", message: "Invalid history format" });
      return { statusCode: 400 };
    }

    // Check if tool result is empty and enhance it
    let enhancedHistory = [...payload.history];
    if (payload.content === "[]" || payload.content === "" || payload.content === "null") {
      console.log("Empty tool result detected, enhancing message");
      // Find the last tool_result and enhance it
      const lastMessage = enhancedHistory[enhancedHistory.length - 1];
      if (lastMessage?.role === "user" && lastMessage?.content?.[0]?.type === "tool_result") {
        lastMessage.content[0].content = "No results found. The search returned empty results.";
        console.log("Enhanced empty tool result");
      }
    }

    try {

      console.log("Creating stream with Anthropic...");
      console.log("Model:", model);
      console.log("System prompt length:", system?.length);
      console.log("Tools count:", tools?.length);
      console.log("History for Anthropic:", JSON.stringify(enhancedHistory, null, 2));

      const stream = await anthropic.messages.stream({
        model,
        system,
        tools,
        max_tokens: 800,
        thinking: { type: "disabled" }, // cheaper + more stable for tool loops
        messages: enhancedHistory,
      });

      const sendWithSeq = wireStream(stream, client, connectionId);
      const finalMessage = await stream.finalMessage();
      await handleFinalMessage(finalMessage, client, connectionId, sendWithSeq, onUsage);
      console.log("Stream completed for tool_result");
    } catch (error) {
      console.error("Error creating stream for tool_result:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      await send(client, connectionId, { type: "error", message: `Encountered error processing tool result: ${error.message}` });
    }
    return { statusCode: 200 };
  }

  // New / continued user message
  const userText = (payload.message || "").trim();
  if (!userText) {
    await send(client, connectionId, { type: "error", message: "Empty message" });
    return { statusCode: 400 };
  }

  await send(client, connectionId, { type: "started" });

  try {
    // Build messages array: existing history + new user message
    const messages = [...history, { role: "user", content: userText }];
    
    const stream = await anthropic.messages.stream({
      model,
      system,
      tools,
      max_tokens: 800,
      thinking: { type: "disabled" },
      messages,
    });
    const sendWithSeq = wireStream(stream, client, connectionId);
    const finalMessage = await stream.finalMessage();
    await handleFinalMessage(finalMessage, client, connectionId, sendWithSeq, onUsage);
  } catch (error) {
    console.error("Stream (new message) error:", error);
    await send(client, connectionId, { type: "error", message: `Stream error: ${error.message}` });
  }

  return { statusCode: 200 };
};
