import * as pty from "node-pty";
import { EventEmitter } from "events";
import { existsSync } from "fs";
import {
  getSafeWorkingDirectory,
  getSafeEnvironment,
  truncateOutputBuffer,
} from "./security";

export interface PTYSession {
  id: string;
  projectId: string;
  ptyProcess: pty.IPty;
  outputBuffer: string;
  cols: number;
  rows: number;
}

class PTYManager extends EventEmitter {
  private sessions: Map<string, PTYSession> = new Map();

  // Create a new PTY session for a project
  createSession(sessionId: string, projectId: string): PTYSession {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const workingDir = getSafeWorkingDirectory(projectId);
    const env = getSafeEnvironment(projectId);

    // Check if working directory exists
    if (!existsSync(workingDir)) {
      console.error(`Working directory does not exist: ${workingDir}`);
      throw new Error(`Project directory not found: ${workingDir}`);
    }

    console.log(`Creating PTY session ${sessionId} in ${workingDir}`);

    // Create PTY process - spawn Claude Code directly
    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn("claude", ["--dangerously-skip-permissions"], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: env,
        encoding: "utf8",
      });
    } catch (error) {
      console.error(`Failed to create PTY process:`, error);
      throw error;
    }

    const session: PTYSession = {
      id: sessionId,
      projectId,
      ptyProcess,
      outputBuffer: "",
      cols: 80,
      rows: 24,
    };

    // Handle PTY output
    ptyProcess.onData((data) => {
      // Append to output buffer and truncate if needed
      session.outputBuffer = truncateOutputBuffer(session.outputBuffer + data);

      // Emit output event
      this.emit("output", sessionId, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(
        `PTY session ${sessionId} exited with code ${exitCode}, signal ${signal}`
      );
      this.emit("exit", sessionId, exitCode, signal);
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    console.log(`Created PTY session ${sessionId} for project ${projectId}`);

    return session;
  }

  // Get an existing session
  getSession(sessionId: string): PTYSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Find session by project ID
  findSessionByProject(projectId: string): PTYSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.projectId === projectId) {
        return session;
      }
    }
    return undefined;
  }

  // Write input to a session
  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.ptyProcess.write(data);
    return true;
  }

  // Resize a session
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.cols = cols;
    session.rows = rows;
    session.ptyProcess.resize(cols, rows);
    return true;
  }

  // Kill a session
  kill(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.ptyProcess.kill();
    this.sessions.delete(sessionId);
    console.log(`Killed PTY session ${sessionId}`);
    return true;
  }

  // Get output buffer for a session
  getOutputBuffer(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.outputBuffer;
  }

  // Kill all sessions (for shutdown)
  killAll(): void {
    for (const [sessionId, session] of this.sessions) {
      session.ptyProcess.kill();
      console.log(`Killed PTY session ${sessionId} during shutdown`);
    }
    this.sessions.clear();
  }

  // Get all active session IDs
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Export singleton instance
export const ptyManager = new PTYManager();
