import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuid } from "uuid";
import { join } from "path";
import type { ClientMessage, ServerMessage } from "./types/websocket";
import { ptyManager } from "./lib/pty/manager";
import { fileWatcher } from "./lib/websocket/file-watcher";
import { remotionProcessManager } from "./lib/remotion/process-manager";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Get projects root
function getProjectsRoot(): string {
  return process.env.PROJECTS_ROOT || join(process.cwd(), "projects");
}

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track connected clients
interface ClientState {
  projectId: string | null;
  sessionId: string | null;
}

const clients = new Map<WebSocket, ClientState>();

// Send message to client
function sendMessage(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Broadcast to all clients connected to a project
function broadcastToProject(projectId: string, message: ServerMessage) {
  for (const [ws, state] of clients) {
    if (state.projectId === projectId) {
      sendMessage(ws, message);
    }
  }
}

// Handle incoming WebSocket messages
function handleMessage(ws: WebSocket, data: string) {
  try {
    const message: ClientMessage = JSON.parse(data);
    const clientState = clients.get(ws);

    if (!clientState) return;

    switch (message.type) {
      case "session:connect": {
        const { projectId } = message;
        clientState.projectId = projectId;

        // Start file watcher for this project
        const remotionPath = join(getProjectsRoot(), projectId, "remotion");

        try {
          fileWatcher.startWatching(projectId, remotionPath);
        } catch (watchError) {
          console.warn("Failed to start file watcher:", watchError);
        }

        // Check if there's an existing session for this project
        let session = ptyManager.findSessionByProject(projectId);

        if (!session) {
          // Create new session
          const sessionId = uuid();
          try {
            session = ptyManager.createSession(sessionId, projectId);
          } catch (ptyError) {
            console.error("Failed to create PTY session:", ptyError);
            sendMessage(ws, {
              type: "session:error",
              error: `Failed to create terminal session: ${ptyError instanceof Error ? ptyError.message : "Unknown error"}`,
            });
            break;
          }
        }

        clientState.sessionId = session.id;

        // Send connection confirmation with output buffer
        sendMessage(ws, {
          type: "session:connected",
          sessionId: session.id,
          outputBuffer: session.outputBuffer,
        });
        break;
      }

      case "session:disconnect": {
        // Kill the PTY session when disconnecting
        if (clientState.sessionId) {
          ptyManager.kill(clientState.sessionId);
        }
        // Stop file watcher for this project
        if (clientState.projectId) {
          fileWatcher.stopWatching(clientState.projectId);
        }
        clientState.projectId = null;
        clientState.sessionId = null;
        break;
      }

      case "terminal:input": {
        if (clientState.sessionId) {
          ptyManager.write(clientState.sessionId, message.data);
        }
        break;
      }

      case "terminal:resize": {
        if (clientState.sessionId) {
          ptyManager.resize(clientState.sessionId, message.cols, message.rows);
        }
        break;
      }

      case "studio:start": {
        const { projectId } = message;
        const remotionPath = join(getProjectsRoot(), projectId, "remotion");

        remotionProcessManager
          .startStudio(projectId, remotionPath)
          .then((studioPort) => {
            sendMessage(ws, {
              type: "studio:started",
              port: studioPort,
            });
          })
          .catch((error) => {
            sendMessage(ws, {
              type: "studio:error",
              error: error.message || "Failed to start studio",
            });
          });
        break;
      }

      case "studio:stop": {
        const { projectId } = message;
        remotionProcessManager.stopStudio(projectId);
        sendMessage(ws, {
          type: "studio:stopped",
        });
        break;
      }

      case "studio:subscribe": {
        // Just set the projectId for this client to receive studio events
        // Don't create a terminal session
        const { projectId } = message;
        clientState.projectId = projectId;

        // If studio is already running, notify the client
        const existingPort = remotionProcessManager.getStudioPort(projectId);
        if (existingPort) {
          sendMessage(ws, {
            type: "studio:started",
            port: existingPort,
          });
        }
        break;
      }

      default:
        console.warn("Unknown message type:", message);
    }
  } catch (error) {
    console.error("Failed to parse WebSocket message:", error);
    sendMessage(ws, {
      type: "session:error",
      error: "Invalid message format",
    });
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server in noServer mode to avoid conflicts with Next.js HMR
  const wss = new WebSocketServer({
    noServer: true,
  });

  // Handle WebSocket upgrade requests manually
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url || "", true);

    // Only handle our WebSocket path, let Next.js handle HMR
    if (pathname === "/api/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
    // Don't close the socket for other paths - let Next.js handle them
  });

  // Set up PTY output handler
  ptyManager.on("output", (sessionId: string, data: string) => {
    // Find all clients connected to this session and send output
    for (const [ws, state] of clients) {
      if (state.sessionId === sessionId) {
        sendMessage(ws, {
          type: "terminal:output",
          data,
        });
      }
    }
  });

  // Set up PTY exit handler
  ptyManager.on("exit", (sessionId: string) => {
    // Notify clients that the session ended
    for (const [ws, state] of clients) {
      if (state.sessionId === sessionId) {
        state.sessionId = null;
        sendMessage(ws, {
          type: "session:error",
          error: "Terminal session ended",
        });
      }
    }
  });

  // Set up file watcher handler
  fileWatcher.on(
    "change",
    (projectId: string, path: string, event: "add" | "change" | "unlink") => {
      broadcastToProject(projectId, {
        type: "file:changed",
        path,
        event,
      });
    }
  );

  // Set up Remotion process manager handlers
  remotionProcessManager.on("error", (projectId: string, error: string) => {
    broadcastToProject(projectId, {
      type: "studio:error",
      error,
    });
  });

  remotionProcessManager.on("exit", (projectId: string) => {
    broadcastToProject(projectId, {
      type: "studio:stopped",
    });
  });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");

    // Initialize client state
    clients.set(ws, {
      projectId: null,
      sessionId: null,
    });

    ws.on("message", (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server on ws://${hostname}:${port}/api/ws`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");

    // Kill all PTY sessions
    ptyManager.killAll();

    // Stop all file watchers
    fileWatcher.stopAll();

    // Stop all Remotion Studio processes
    remotionProcessManager.stopAll();

    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
      ws.close();
    });

    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
