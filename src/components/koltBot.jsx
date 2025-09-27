import React, { useEffect, useRef, useState } from "react";
import { Input, Group, Button, Box, For, Stack, Text, Flex} from "@chakra-ui/react";
import { SendHorizonal } from 'lucide-react';

export function KoltBot({
  wsUrl = process.env.REACT_APP_WS_URL,
}) {
  const [status, setStatus] = useState("disconnected");
  const [input, setInput] = useState("");
  const [buffer, setBuffer] = useState("");
  const [lines, setLines] = useState(["(opening WebSocket…)"]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const wsRef = useRef(null);
  const outRef = useRef(null);

  // autoscroll
  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [lines, buffer]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setLines((l) => [...l, "Connected"]);
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setLines((l) => [...l, "Disconnected"]);
    };

    ws.onerror = () => {
      setLines((l) => [...l, "Error"]);
    };

    ws.onmessage = (e) => {
      console.log("Received message:", e.data);
      try {
        const m = JSON.parse(e.data);
        console.log("Parsed message:", m);
        if (m.type === "delta") {
          setBuffer((b) => b + (m.text || ""));
        } else if (m.type === "done") {
          // flush final assistant line
          if (buffer.length > 0) {
            setLines((l) => [...l, "Assistant: " + buffer, ""]);
            setBuffer("");
          }
        } else if (m.type === "error") {
          setLines((l) => [...l, "ERROR: " + (m.message || "unknown")]);
        } else if (typeof e.data === "string") {
          // fallback text
          setLines((l) => [...l, e.data]);
        }
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
    if (!t || !wsRef.current || wsRef.current.readyState !== 1) return;

    if (buffer.length > 0) {
        setLines((l) => [...l, "Assistant: " + buffer]);
        setBuffer("");
    }
    setLines((l) => [...l, "You: " + t]);
    const payload = { message: t };
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
  };

  const renderMessage = (message, index) => {
    // Skip empty messages
    if (!message.trim()) return null;

    const isUser = message.startsWith("You: ");
    const isAssistant = message.startsWith("Assistant: ");
    const isSystem = !isUser && !isAssistant;

    // Extract message content
    const content = isUser ? message.replace("You: ", "") : 
                   isAssistant ? message.replace("Assistant: ", "") : 
                   message;

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
      <Flex 
        key={index} 
        justify={isUser ? "flex-end" : "flex-start"} 
        mb={3}
        px={2}
      >
        <Box
          maxW="70%"
          bg = { isUser ? "" : "#483AA0"}
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

      <Box
        ref={outRef}
        style={{
          padding: 12,
          height: 500,
          overflow: "auto",
        }}
        borderColor="gray.200"
      >
        <Stack spacing={0}>
          <For each={lines}>
            {(item, index) => renderMessage(item, index)}
          </For>
          {buffer && (
            <Flex justify="flex-start" mb={3} px={2}>
              <Box
                maxW="70%"
                bg = "#483AA0"
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
        <Group attached w="full">
          <Input
            variant="flushed"
            fontFamily="body"
            value={input}
            padding={3}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
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
            textShadow={isInputFocused ? "0 0 8px #483AA0" : ""}
            borderColor={isInputFocused ? "#483AA0" : "#4a4567ff"}
            boxShadow={isInputFocused ? "0 0 20px rgba(72, 58, 160, 0.6)" : "none"}
            disabled={status !== "connected"}
            style={{
              cursor: status === "connected" ? "pointer" : "not-allowed",
            }}
          >
            <SendHorizonal textShadow={isInputFocused ? "0 0 8px #483AA0" : ""} />
          </Button>
        </Group>
      </form>
    </div>
  );
}