"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "@/types/websocket";

interface UseWebSocketOptions {
  projectId: string;
  onTerminalOutput?: (data: string) => void;
  onConnected?: (sessionId: string, outputBuffer?: string) => void;
  onError?: (error: string) => void;
  onFileChanged?: (path: string, event: "add" | "change" | "unlink") => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sessionId: string | null;
  sendTerminalInput: (data: string) => void;
  sendTerminalResize: (cols: number, rows: number) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { projectId, onTerminalOutput, onConnected, onError, onFileChanged } =
    options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      // Request session for this project
      sendMessage({ type: "session:connect", projectId });
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case "session:connected":
            setIsConnected(true);
            setSessionId(message.sessionId);
            onConnected?.(message.sessionId, message.outputBuffer);
            break;

          case "terminal:output":
            onTerminalOutput?.(message.data);
            break;

          case "session:error":
            onError?.(message.error);
            break;

          case "file:changed":
            onFileChanged?.(message.path, message.event);
            break;

          default:
            console.log("Unhandled message:", message);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      onError?.("WebSocket connection error");
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      setSessionId(null);
    };
  }, [projectId, sendMessage, onTerminalOutput, onConnected, onError, onFileChanged]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      sendMessage({ type: "session:disconnect" });
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setSessionId(null);
    }
  }, [sendMessage]);

  const sendTerminalInput = useCallback(
    (data: string) => {
      sendMessage({ type: "terminal:input", data });
    },
    [sendMessage]
  );

  const sendTerminalResize = useCallback(
    (cols: number, rows: number) => {
      sendMessage({ type: "terminal:resize", cols, rows });
    },
    [sendMessage]
  );

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    sessionId,
    sendTerminalInput,
    sendTerminalResize,
    connect,
    disconnect,
  };
}
