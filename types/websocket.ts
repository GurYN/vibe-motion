// WebSocket message types for Vibe Motion

// Client → Server messages
export type ClientMessage =
  | { type: "terminal:input"; data: string }
  | { type: "terminal:resize"; cols: number; rows: number }
  | { type: "session:connect"; projectId: string }
  | { type: "session:disconnect" }
  | { type: "studio:start"; projectId: string }
  | { type: "studio:stop"; projectId: string }
  | { type: "studio:subscribe"; projectId: string };

// Server → Client messages
export type ServerMessage =
  | { type: "terminal:output"; data: string }
  | { type: "session:connected"; sessionId: string; outputBuffer?: string }
  | { type: "session:error"; error: string }
  | { type: "file:changed"; path: string; event: "add" | "change" | "unlink" }
  | { type: "studio:started"; port: number }
  | { type: "studio:stopped" }
  | { type: "studio:error"; error: string }
  | { type: "export:progress"; exportId: string; progress: number }
  | { type: "export:completed"; exportId: string; outputPath: string }
  | { type: "export:failed"; exportId: string; error: string };

// Parsed message with metadata
export interface ParsedMessage {
  message: ClientMessage;
  timestamp: Date;
}

// Connection state
export interface ConnectionState {
  projectId: string | null;
  sessionId: string | null;
  isConnected: boolean;
}
