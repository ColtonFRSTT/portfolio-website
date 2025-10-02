import React, { useEffect, useRef, useState } from "react";
import { Input, Button, Box, Stack, Text, Flex } from "@chakra-ui/react";
import { SendHorizonal } from "lucide-react";

const apiGatewayUrl = process.env.REACT_APP_API_URL;

function trimHistory(history, maxHistory = 6) {
  const trimmed = history.slice(-maxHistory);

  const toolResultIds = new Set();
  trimmed.forEach(msg => {
    if (msg.role === "user" && msg.content) {
      msg.content.forEach(content => {
        if (content.type === "tool_result" && content.tool_use_id) {
          toolResultIds.add(content.tool_use_id);
        }
      });
    }
  });

  const toolUseIds = new Set();
  trimmed.forEach(msg => {
    if (msg.role === "assistant" && msg.content) {
      msg.content.forEach(content => {
        if (content.type === "tool_use" && content.id) {
          toolUseIds.add(content.id);
        }
      });
    }
  });

  const orphanedIds = [...toolResultIds].filter(id => !toolUseIds.has(id));

  // Find the tool_use messages for each orphaned ID in the original history
  const orphanedToolUses = [];
  orphanedIds.forEach(orphanedId => {
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.content) {
        const hasMatchingToolUse = msg.content.some(content => 
          content.type === "tool_use" && content.id === orphanedId
        );
        
        if (hasMatchingToolUse) {
          orphanedToolUses.push(msg);
          break; // Found it, move to next orphaned ID
        }
      }
    }
  });
  
  // Add orphaned tool_use messages to the beginning of trimmed history
  return [...orphanedToolUses, ...trimmed];
}

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

  const pendingAcks = new Map();
  const outbox = []; // queued messages if WS closes before send

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
      outbox.push(obj);
      return;
    }
    wsRef.current.send(JSON.stringify(obj));
  }

  function sendWithAck(msg, key, timeoutMs = 10000) {
    sendRaw(msg);
    const t = setTimeout(() => {
      console.error("ACK timeout → server never received", key);
    }, timeoutMs);
    pendingAcks.set(key, t);
  }

  function flushOutbox() {
    if (!wsOpen()) return;
    while (outbox.length) {
      const obj = outbox.shift();
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

    ws.onmessage = async (e) => {
      try {
        const m = JSON.parse(e.data);
        console.log(`Received message:`, m);

        if (m.type === "ack" && pendingAcks.has(m.tool_use_id)) {
          clearTimeout(pendingAcks.get(m.tool_use_id));
          pendingAcks.delete(m.tool_use_id);
          console.log("ACK received for", m.tool_use_id);
          return;
        }

        if (m.type === "delta") {
          console.log(`Delta text: "${m.text}"`);
          setBuffer((b) => b + (m.text || ""));
          return;
        }

        if (m.type === "done") {
          console.log("Received done message, current buffer:", buffer);
          // Use a callback to get the current buffer state
          setBuffer((currentBuffer) => {
            if (currentBuffer.length > 0) {
              console.log(`Flushing buffer on done: "${currentBuffer}"`);
              pushAssistant(setLines, currentBuffer);
              setHistory((prevHistory) => [...prevHistory, { 
                role: "assistant", 
                content: [{ type: "text", text: currentBuffer }] 
              }]);
            }
            return ""; // Clear buffer
          });
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
          
          if (buffer.length > 0) {
            console.log(`Flushing buffer before tool use: "${buffer}"`);
            pushAssistant(setLines, buffer);
            
            // Add buffered text to history
            currentHistory = [...currentHistory, { 
              role: "assistant", 
              content: [{ type: "text", text: buffer }] 
            }];
            setBuffer("");
          }
          
          // Add tool_use to history (after any buffered text)
          currentHistory = [...currentHistory, { 
            role: "assistant", 
            content: [{ type: "tool_use", id, name, input }] 
          }];
          
          // Update history state
          setHistory(currentHistory);
          console.log(`Updated history with tool_use`);

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
            const trimmedHistory = trimHistory(nextHistory, 6);
            const toolResultPayload = {
              type: "tool_result",
              tool_use_id: id,
              content: resultString,
              history: trimmedHistory,
            };
            console.log(`Sending tool_result:`, toolResultPayload);
            // wsRef.current?.send(JSON.stringify(toolResultPayload));
            sendWithAck(toolResultPayload, toolResultPayload.tool_use_id);

          } catch (err) {
            const trimmedHistory = trimHistory(currentHistory, 6);
            console.error(`❌ Tool execution error:`, err);
            const errorPayload = {
              type: "tool_result",
              tool_use_id: id,
              error: String(err),
              history: trimmedHistory,
            };
            console.log(`Sending tool error:`, errorPayload);
            console.log("Sending tool error(history):", currentHistory);
            wsRef.current?.send(JSON.stringify(errorPayload));
          }
          return;
        }

        // fallback text
        if (typeof e.data === "string") setLines((l) => [...l, e.data]);
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
    
    if (!t || !wsRef.current || wsRef.current.readyState !== 1) {
      console.log(`Cannot send - empty input or WebSocket not ready`);
      return;
    }

    if (buffer.length > 0) {
      console.log(`Flushing buffer before sending: "${buffer}"`);
      setLines((l) => [...l, "Assistant: " + buffer]);
      setBuffer("");
    }

    const nextHistory = [...historyRef.current, { role: "user", content: [{ type: "text", text: t }] }];
    setHistory(nextHistory);
    setLines((l) => [...l, "You: " + t]);
    
    const trimmedHistory = trimHistory(nextHistory, 6);
    const payload = { message: t, history: trimmedHistory };
    console.log(`Sending message: ${payload}, History: ${trimmedHistory}`);
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
