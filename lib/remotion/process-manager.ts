import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { existsSync } from "fs";
import { join } from "path";
import getPort from "get-port";

interface StudioProcess {
  projectId: string;
  process: ChildProcess;
  port: number;
  remotionPath: string;
}

class RemotionProcessManager extends EventEmitter {
  private studios: Map<string, StudioProcess> = new Map();
  private portRange = { start: 3001, end: 3100 };

  // Check if node_modules exists in the project
  private hasNodeModules(remotionPath: string): boolean {
    return existsSync(join(remotionPath, "node_modules"));
  }

  // Install dependencies in the project
  private async installDependencies(remotionPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Installing dependencies in ${remotionPath}...`);

      const installProcess = spawn("npm", ["install"], {
        cwd: remotionPath,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });

      let stderr = "";

      installProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      installProcess.on("error", (error) => {
        reject(new Error(`Failed to start npm install: ${error.message}`));
      });

      installProcess.on("exit", (code) => {
        if (code === 0) {
          console.log(`Dependencies installed successfully in ${remotionPath}`);
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  // Start Remotion Studio for a project
  async startStudio(projectId: string, remotionPath: string): Promise<number> {
    // Check if studio is already running
    const existing = this.studios.get(projectId);
    if (existing) {
      return existing.port;
    }

    // Check if dependencies are installed, if not install them
    if (!this.hasNodeModules(remotionPath)) {
      try {
        await this.installDependencies(remotionPath);
      } catch (error) {
        console.error(`Failed to install dependencies:`, error);
        throw error;
      }
    }

    // Find available port
    const port = await getPort({
      port: Array.from(
        { length: this.portRange.end - this.portRange.start + 1 },
        (_, i) => this.portRange.start + i
      ),
    });

    // Start Remotion Studio using spawn (safe process execution)
    // --no-open prevents it from opening a browser window automatically
    const studioProcess = spawn("npx", ["remotion", "studio", "--port", port.toString(), "--no-open"], {
      cwd: remotionPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false, // Important: don't use shell to avoid injection
    });

    studioProcess.stdout?.on("data", (data) => {
      console.log(`[Studio ${projectId}] ${data.toString()}`);
    });

    studioProcess.stderr?.on("data", (data) => {
      console.error(`[Studio ${projectId}] ${data.toString()}`);
    });

    studioProcess.on("error", (error) => {
      console.error(`Studio process error for ${projectId}:`, error);
      this.emit("error", projectId, error.message);
      this.studios.delete(projectId);
    });

    studioProcess.on("exit", (code, signal) => {
      console.log(`Studio ${projectId} exited with code ${code}, signal ${signal}`);
      this.emit("exit", projectId, code);
      this.studios.delete(projectId);
    });

    // Store process info
    this.studios.set(projectId, {
      projectId,
      process: studioProcess,
      port,
      remotionPath,
    });

    console.log(`Started Remotion Studio for ${projectId} on port ${port}`);
    this.emit("started", projectId, port);

    return port;
  }

  // Stop Remotion Studio for a project
  stopStudio(projectId: string): boolean {
    const studio = this.studios.get(projectId);
    if (!studio) {
      return false;
    }

    studio.process.kill("SIGTERM");
    this.studios.delete(projectId);
    console.log(`Stopped Remotion Studio for ${projectId}`);
    this.emit("stopped", projectId);

    return true;
  }

  // Get studio port for a project
  getStudioPort(projectId: string): number | null {
    return this.studios.get(projectId)?.port ?? null;
  }

  // Check if studio is running for a project
  isRunning(projectId: string): boolean {
    return this.studios.has(projectId);
  }

  // Stop all studios (for shutdown)
  stopAll(): void {
    for (const [projectId, studio] of this.studios) {
      studio.process.kill("SIGTERM");
      console.log(`Stopped Remotion Studio for ${projectId} during shutdown`);
    }
    this.studios.clear();
  }

  // Get all running studio info
  getRunningStudios(): { projectId: string; port: number }[] {
    return Array.from(this.studios.values()).map(({ projectId, port }) => ({
      projectId,
      port,
    }));
  }
}

// Export singleton instance
export const remotionProcessManager = new RemotionProcessManager();
