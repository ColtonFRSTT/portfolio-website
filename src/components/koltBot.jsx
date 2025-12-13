import React, { useEffect, useRef, useState } from "react";
import { Input, Button, Box, Stack, Text, Flex } from "@chakra-ui/react";
import { SendHorizonal } from "lucide-react";

const apiGatewayUrl = process.env.REACT_APP_API_URL;

// ...existing code...
function trimHistory(history, targetCount) {
  const required = new Set(); // tool_use ids we still need to include
  const collected = [];

  // Helper to inspect a message and return:
  // { useId: string | null, resultId: string | null }
  function extractIds(msg) {
    let useId = null;
    let resultId = null;

    for (const part of msg.content || []) {
      if (part.type === "tool_use") {
        useId = part.id;
      }
      if (part.type === "tool_result") {
        resultId = part.tool_use_id;
      }
    }
    return { useId, resultId };
  }

  // Walk backward
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const { useId, resultId } = extractIds(msg);

    let mustInclude = false;

    // If this is a tool_result, we need its tool_use
    if (resultId) {
      required.add(resultId);
      mustInclude = true;
    }

    // If this is a tool_use we needed, include and remove from required
    if (useId && required.has(useId)) {
      required.delete(useId);
      mustInclude = true;
    }

    // If we haven't reached the rough count yet, keep pulling messages
    if (!mustInclude && collected.length < targetCount) {
      mustInclude = true;
    }

    if (mustInclude) {
      collected.push(msg);
    }

    // If we hit our count AND all dependencies are resolved, stop
    if (collected.length >= targetCount && required.size === 0) {
      break;
    }
  }

  return collected.reverse();
}

// ...existing code...

async function callClaudeTool(name, input) {
  console.log(`Calling tool: ${name}`, input);
  const url =
    name === "github_search"
      ? `${apiGatewayUrl}/dev/koltBotGitSearch`
      : `${apiGatewayUrl}/dev/koltBotGitFile`;
  console.log(`Tool URL: ${url}`);
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  
  console.log(`Tool response status: ${res.status}`);
  if (!res.ok) {
    console.log(`Tool HTTP error: ${res.status}`);
    throw new Error(`Tool HTTP ${res.status}`);
  }
  
  const result = await res.json();
  console.log(`Tool result:`, result);
  return result;
}

export function KoltBot({ wsUrl = process.env.REACT_APP_WS_URL }) {
  const [status, setStatus] = useState("disconnected");
  const [input, setInput] = useState("");
  const [buffer, setBuffer] = useState("");
  const [lines, setLines] = useState(["(opening WebSocket…)"]);
  const wsRef = useRef(null);
  const outRef = useRef(null);
  const bufferRef = useRef(""); // Add ref to track current buffer state
  const processingToolRef = useRef(false); // Track if we're processing a tool
  const messageQueueRef = useRef([]); // Queue for messages received during tool processing
  // Reordering + debounce for deltas
  const pendingDeltasRef = useRef([]); // newly arrived, waiting for flush
  const bufferPiecesRef = useRef([]);  // all pieces for current assistant turn
  const deltaFlushTimerRef = useRef(null);

  const pendingAcksRef = useRef(new Map());
  const outboxRef = useRef([]);

  function pushAssistant(linesSetter, text) {
    if (!text) return;
    linesSetter(prev => {
      const last = prev[prev.length - 1];
      const msg = "Assistant: " + text;
      return last === msg ? prev : [...prev, msg];
    });
  }

  function wsOpen() {
    return wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
  }

  function sendRaw(obj) {
    if (!wsOpen()) {
      console.warn("Tried to send but WS not open", obj);
      outboxRef.current.push(obj);
      return;
    }
    wsRef.current.send(JSON.stringify(obj));
  }

  function sendWithAck(msg, key, timeoutMs = 10000) {
    sendRaw(msg);
    const t = setTimeout(() => {
      console.error("ACK timeout → server never received", key);
    }, timeoutMs);
    pendingAcksRef.current.set(key, t);
  }

  function flushOutbox() {
    if (!wsOpen()) return;
    while (outboxRef.current.length) {
      const obj = outboxRef.current.shift();
      sendRaw(obj);
    }
  }

  // Chat history (Anthropic message schema)
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  useEffect(() => {
    console.log(`History updated:`, history);
    historyRef.current = history;
  }, [history]);

  // Sync buffer ref with buffer state
  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  // autoscroll
  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [lines, buffer]);

  useEffect(() => {
    console.log(`Initializing WebSocket connection to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`WebSocket connected successfully`);
      setStatus("connected");
      setLines((l) => [...l, "Connected"]);
      flushOutbox();
    };

    ws.onclose = (event) => {
      console.log(`WebSocket closed:`, { code: event.code, reason: event.reason });
      setStatus("disconnected");
      setLines((l) => [...l, "Disconnected"]);
    };

    ws.onerror = (error) => {
      console.log(`WebSocket error:`, error);
      setLines((l) => [...l, "Error"]);
    };

    // Process any queued messages after tool processing is complete
    // const processQueuedMessages = async () => {
    //   if (processingToolRef.current || messageQueueRef.current.length === 0) {
    //     return;
    //   }

    //   const queuedMessage = messageQueueRef.current.shift();
    //   console.log("Processing queued message:", queuedMessage);
      
    //   // Process the queued message by calling the message handler again
    //   await handleMessage(queuedMessage);
      
    //   // Process any remaining messages
    //   if (messageQueueRef.current.length > 0) {
    //     setTimeout(processQueuedMessages, 0);
    //   }
    // };

    // Message handling function
    const handleMessage = async (m) => {
      if (m.type === "ack" && pendingAcksRef.current.has(m.tool_use_id)) {
        clearTimeout(pendingAcksRef.current.get(m.tool_use_id));
        pendingAcksRef.current.delete(m.tool_use_id);
        console.log("ACK received for", m.tool_use_id);
        return;
      }

      if (m.type === "delta") {
        // If we're processing a tool, queue this delta message
        if (processingToolRef.current) {
          console.log(`Ignoring delta during tool processing: "${m.text}"`);
          return;
        }

        // Buffer deltas with seq for stable ordering
        const seq = typeof m.seq === 'number' ? m.seq : null;
        const text = m.text || "";
        console.log(`Delta text: "${text}" seq=${seq}`);
        pendingDeltasRef.current.push({ seq, text });

        // Debounce flush to reduce choppiness
        if (!deltaFlushTimerRef.current) {
          deltaFlushTimerRef.current = setTimeout(() => {
            const items = pendingDeltasRef.current;
            pendingDeltasRef.current = [];
            deltaFlushTimerRef.current = null;

            // Accumulate into bufferPieces, then rebuild buffer deterministically
            bufferPiecesRef.current.push(...items);

            const sorted = [...bufferPiecesRef.current].sort((a, b) => {
              if (a.seq == null && b.seq == null) return 0;
              if (a.seq == null) return 1; // unknown seq after known
              if (b.seq == null) return -1;
              return a.seq - b.seq;
            });

            const rebuilt = sorted.map(i => i.text).join('');
            bufferRef.current = rebuilt;
            setBuffer(rebuilt);
          }, 30);
        }
        return;
      }

      if (m.type === "done") {
        // If we're processing a tool, queue this done message
        if (processingToolRef.current) {
          console.log("ignoring done during tool use");
          return;
        }

        // Immediate flush of any pending deltas upon done
        if (deltaFlushTimerRef.current) {
          clearTimeout(deltaFlushTimerRef.current);
          deltaFlushTimerRef.current = null;
        }
        if (pendingDeltasRef.current.length) {
          const items = pendingDeltasRef.current;
          pendingDeltasRef.current = [];
          bufferPiecesRef.current.push(...items);
        }

        // Rebuild buffer in order before finalizing
        if (bufferPiecesRef.current.length) {
          const sorted = [...bufferPiecesRef.current].sort((a, b) => {
            if (a.seq == null && b.seq == null) return 0;
            if (a.seq == null) return 1;
            if (b.seq == null) return -1;
            return a.seq - b.seq;
          });
          const rebuilt = sorted.map(i => i.text).join('');
          bufferRef.current = rebuilt;
          setBuffer(rebuilt);
        }

        console.log("Received done message, current buffer:", bufferRef.current);
        const currentBuffer = bufferRef.current;
        
        if (currentBuffer.length > 0) {
          console.log(`Flushing buffer on done: "${currentBuffer}"`);
          pushAssistant(setLines, currentBuffer);
          setHistory((prevHistory) => [...prevHistory, { 
            role: "assistant", 
            content: [{ type: "text", text: currentBuffer }] 
          }]);
        }
        
  setBuffer("");
  bufferRef.current = "";
  bufferPiecesRef.current = [];
        return;
      }

      if (m.type === "error") {
        setLines((l) => [...l, "ERROR: " + (m.message || "unknown")]);
        return;
      }

      if (m.type === "tool_use") {
        console.log(`Tool use requested:`, { name: m.name, input: m.input, id: m.id });
        const { name, input, id } = m;


        // CRITICAL: Always flush buffer and add text to history BEFORE tool_use
        let currentHistory = [...historyRef.current];
  const currentBuffer = bufferRef.current;
        
        if (currentBuffer.length > 0) {
          console.log(`Flushing buffer before tool use: "${currentBuffer}"`);
          pushAssistant(setLines, currentBuffer);
          
          // Add buffered text to history
          currentHistory = [...currentHistory, { 
            role: "assistant", 
            content: [{ type: "text", text: currentBuffer }] 
          }];
        }
        
  setBuffer("");
  bufferRef.current = "";
  bufferPiecesRef.current = [];

        // Add tool_use to history (after any buffered text)
        currentHistory = [...currentHistory, { 
          role: "assistant", 
          content: [{ type: "tool_use", id, name, input }] 
        }];
        
        // Update history state
        setHistory(currentHistory);
        console.log(`Updated history with tool_use`);

        processingToolRef.current = true;

        try {
          const result = await callClaudeTool(name, input);

          const resultString = Array.isArray(result) 
            ? JSON.stringify(result, null, 2)
            : typeof result === 'object' 
              ? JSON.stringify(result, null, 2)
              : String(result);

          console.log(`Formatted tool result as string:`, resultString);
          
          // Add tool_result to current history
          const nextHistory = [...currentHistory, {
              role: "user", 
              content: [{ 
                  type: "tool_result", 
                  tool_use_id: id, 
                  content: resultString
              }] 
          }];
          
          setHistory(nextHistory);
          console.log(`Updated history with tool_result`);

          // Send tool_result + full history back to server
          const trimmedHistory = trimHistory(nextHistory, 12);
          const toolResultPayload = {
            type: "tool_result",
            tool_use_id: id,
            content: resultString,
            history: trimmedHistory,
          };
          console.log(`Sending tool_result:`, toolResultPayload);
          sendWithAck(toolResultPayload, toolResultPayload.tool_use_id);

        } catch (err) {
          // Format error as string
          const errorString =
            (err && typeof err === "object" && err.message) ? err.message : String(err);

          // Add tool_result (error) to history so trimming preserves it
          const failedHistory = [
            ...currentHistory,
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: id,
                  content: errorString,
                  is_error: true,
                },
              ],
            },
          ];
          setHistory(failedHistory);

          const trimmedHistory = trimHistory(failedHistory, 12);
          console.error(`Tool execution error:`, err);

          // Send tool_result with content (not "error") so server/Claude can consume it
          const errorPayload = {
            type: "tool_result",
            tool_use_id: id,
            content: errorString,
            is_error: true,
            history: trimmedHistory,
          };
          console.log(`Sending tool error:`, errorPayload);
          sendWithAck(errorPayload, errorPayload.tool_use_id);
        } finally {
          // Clear processing flag and process any queued messages
          console.log("Tool processing complete, clearing flag and processing queue");
          processingToolRef.current = false;
        }
        return;
      }

      // fallback text - this shouldn't be reached with JSON messages
      console.log("Fallback text handling - unexpected message format:", m);
    };

    ws.onmessage = async (e) => {
      try {
        const m = JSON.parse(e.data);
        console.log(`Received message:`, m);
        await handleMessage(m);
      } catch {
        setLines((l) => [...l, e.data]);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsUrl]);

  const send = (e) => {
    e.preventDefault();
    const t = input.trim();
    console.log(`User input: "${t}"`);
    
    if (!t || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log(`Cannot send - empty input or WebSocket not ready`);
      return;
    }

    const currentBuffer = bufferRef.current;
    if (currentBuffer.length > 0) {
      console.log(`Flushing buffer before sending: "${currentBuffer}"`);
      setLines((l) => [...l, "Assistant: " + currentBuffer]);
      setBuffer("");
      bufferRef.current = "";
    }

    const nextHistory = [...historyRef.current, { role: "user", content: [{ type: "text", text: t }] }];
    setHistory(nextHistory);
    setLines((l) => [...l, "You: " + t]);
    
    const trimmedHistory = trimHistory(nextHistory, 12);
    const payload = { message: t, history: trimmedHistory };
    console.log(`Sending message: ${payload}, History: ${trimmedHistory}`, payload);
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
  };

  const renderMessage = (message, index) => {
    if (!message.trim()) return null;
    const isUser = message.startsWith("You: ");
    const isAssistant = message.startsWith("Assistant: ");
    const isSystem = !isUser && !isAssistant;
    const content = isUser ? message.slice(5) : isAssistant ? message.slice(11) : message;

    if (isSystem) {
      return (
        <Flex key={index} justify="center" mb={2}>
          <Text fontSize="sm" color="gray.500" fontStyle="italic">
            {content}
          </Text>
        </Flex>
      );
    }

    return (
      <Flex key={index} justify={isUser ? "flex-end" : "flex-start"} mb={3} px={2}>
        <Box
          maxW="70%"
          bg={isUser ? "" : "#483AA0"}
          color={"white"}
          px={4}
          py={2}
          borderRadius="lg"
          borderBottomRightRadius={isUser ? "sm" : "lg"}
          borderBottomLeftRadius={isUser ? "lg" : "sm"}
          boxShadow="0 0 20px rgba(72, 58, 160, 0.6)"
        >
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {content}
          </Text>
        </Box>
      </Flex>
    );
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "24px auto" }}>
      <Box style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong>KoltBot Chat</strong>
        <span
          title={status}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: status === "connected" ? "#483AA0" : "#bb2b2bff",
            display: "inline-block",
          }}
        />
      </Box>

      <Box ref={outRef} style={{ padding: 12, height: 500, overflow: "auto" }} borderColor="gray.200">
        <Stack spacing={0}>
          {lines.map((item, index) => renderMessage(item, index))}
          {buffer && (
            <Flex justify="flex-start" mb={3} px={2}>
              <Box
                maxW="70%"
                bg="#483AA0"
                color={"white"}
                px={4}
                py={2}
                borderRadius="lg"
                borderBottomRightRadius={"lg"}
                borderBottomLeftRadius={"sm"}
                boxShadow="0 0 20px rgba(72, 58, 160, 0.6)"
              >
                <Text fontSize="sm" whiteSpace="pre-wrap">
                  {buffer}
                </Text>
              </Box>
            </Flex>
          )}
        </Stack>
      </Box>

      <form onSubmit={send} style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <Input
          variant="flushed"
          value={input}
          padding={3}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Prompt..."
          borderColor="#4a4567ff"
          _focus={{
            textShadow: "0 0 8px #483AA0",
            borderColor: "#483AA0",
            boxShadow: "0 0 20px rgba(72, 58, 160, 0.6)",
          }}
        />
        <Button
          variant="outline"
          borderLeft="none"
          borderTop="none"
          borderRight="none"
          borderColor="#4a4567ff"
          disabled={status !== "connected"}
        >
          <SendHorizonal />
        </Button>
      </form>
    </div>
  );
}
