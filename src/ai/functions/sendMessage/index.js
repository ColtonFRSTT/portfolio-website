import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function agClient(event) {
  const { domainName, stage } = event.requestContext; // e.g. abc.execute-api.us-east-1.amazonaws.com / prod
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
}
async function send(client, connectionId, data) {
  const Data = Buffer.from(typeof data === "string" ? data : JSON.stringify(data));
  try {
    await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data }));
  } catch (e) {
    // GoneException = client disconnected; ignore
  }
}

export const handler = async (event) => {
  console.log("=== LAMBDA STARTED ===");
  console.log("Lambda invoked with event:", JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;
    const client = agClient(event);

    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}

    console.log("Parsed payload:", payload);

    const userText = (payload.message || "").trim();
    if (!userText) { 
      await send(client, connectionId, { type:"error", message:"Empty message"}); 
      return { statusCode: 400 }; 
    }

    console.log("User text:", userText);
    await send(client, connectionId, { type:"started" });

    const model = payload.model || "claude-3-7-sonnet-20250219"; // Fixed model name
    const system = payload.system || "You are a helpful assistant.";

    // Stream tokens from Claude and relay to the same WS connection
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role:"user", content:userText }]
    });

    stream.on("text", async (t) => { await send(client, connectionId, { type:"delta", text: t }); });
    stream.on("message", async (msg) => { await send(client, connectionId, { type:"done", message: msg }); });
    stream.on("error", async (err) => { await send(client, connectionId, { type:"error", message: String(err?.message||err) }); });

    await stream.finalMessage(); // wait for completion
    return { statusCode: 200 };
  } catch (error) {
    console.error("Lambda error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
