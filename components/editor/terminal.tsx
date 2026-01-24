"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  projectId: string;
  onReady?: () => void;
}

export function Terminal({ projectId, onReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionConnectedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const [isConnected, setIsConnected] = useState(false);

  // Keep the ref updated
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Initialize terminal and WebSocket
  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal instance
    const terminal = new XTerm({
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
        cursorAccent: "#0a0a0a",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
      allowProposedApi: true,
    });

    // Create and load addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal in container
    terminal.open(containerRef.current);
    fitAddon.fit();

    // Focus the terminal so it can receive keyboard input
    terminal.focus();

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    // Send message helper (only if connected)
    const sendMessage = (message: object) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    };

    ws.onopen = () => {
      console.log("Terminal WebSocket connected");
      // Request session for this project
      sendMessage({ type: "session:connect", projectId });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "session:connected":
            sessionConnectedRef.current = true;
            setIsConnected(true);
            // Write output buffer if available
            if (message.outputBuffer) {
              terminal.write(message.outputBuffer);
            }
            // Send initial resize
            const { cols, rows } = terminal;
            sendMessage({ type: "terminal:resize", cols, rows });
            onReadyRef.current?.();
            break;

          case "terminal:output":
            terminal.write(message.data);
            break;

          case "session:error":
            terminal.write(`\r\n\x1b[31mError: ${message.error}\x1b[0m\r\n`);
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = () => {
      // WebSocket errors are usually followed by onclose, so we handle reconnection there
      // Only show error if we were previously connected
      if (sessionConnectedRef.current) {
        terminal.write("\r\n\x1b[31mConnection error\x1b[0m\r\n");
      }
    };

    ws.onclose = () => {
      console.log("Terminal WebSocket disconnected");
      sessionConnectedRef.current = false;
      setIsConnected(false);
      terminal.write("\r\n\x1b[33mDisconnected\x1b[0m\r\n");
    };

    // Handle user input - only send if session is connected
    const onDataDisposable = terminal.onData((data) => {
      if (sessionConnectedRef.current && ws.readyState === WebSocket.OPEN) {
        sendMessage({ type: "terminal:input", data });
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        if (sessionConnectedRef.current && ws.readyState === WebSocket.OPEN) {
          const { cols, rows } = terminalRef.current;
          sendMessage({ type: "terminal:resize", cols, rows });
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      // Kill the terminal session when leaving the project
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "session:disconnect", projectId }));
      }
      ws.close();
      terminal.dispose();
    };
  }, [projectId]);

  // Focus terminal when container is clicked
  const handleContainerClick = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.focus();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#0a0a0a] rounded-lg overflow-hidden cursor-text"
      style={{ minHeight: "200px" }}
      onClick={handleContainerClick}
    />
  );
}
