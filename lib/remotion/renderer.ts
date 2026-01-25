import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { join, resolve } from "path";
import { mkdir } from "fs/promises";
import type { ExportFormat } from "@/lib/validators/export";

interface RenderJob {
  id: string;
  projectId: string;
  process: ChildProcess;
  progress: number;
  outputPath: string;
}

// Format to file extension mapping
const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  MP4: ".mp4",
  WEBM: ".webm",
  GIF: ".gif",
};

// Format to Remotion codec mapping
const FORMAT_CODEC_MAP: Record<string, string> = {
  h264: "h264",
  h265: "h265",
  vp8: "vp8",
  vp9: "vp9",
  gif: "gif",
};

class VideoRenderer extends EventEmitter {
  private jobs: Map<string, RenderJob> = new Map();

  // Start a new render job
  async startRender(
    exportId: string,
    projectId: string,
    remotionPath: string,
    exportsPath: string,
    options: {
      compositionId: string;
      format: ExportFormat;
      codec: string;
      quality: number;
    }
  ): Promise<string> {
    const { compositionId, format, codec, quality } = options;

    // Resolve to absolute paths to avoid issues with cwd
    const absoluteExportsPath = resolve(exportsPath);
    const absoluteRemotionPath = resolve(remotionPath);

    // Ensure exports directory exists
    await mkdir(absoluteExportsPath, { recursive: true });

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = FORMAT_EXTENSIONS[format];
    const outputFilename = `${compositionId}_${timestamp}${extension}`;
    const outputPath = join(absoluteExportsPath, outputFilename);

    // Build render command arguments (safe: using spawn with array args)
    const args = [
      "remotion",
      "render",
      compositionId,
      outputPath,
      "--codec",
      FORMAT_CODEC_MAP[codec] || codec,
    ];

    // Add quality for supported formats
    if (format !== "GIF") {
      args.push("--crf", quality.toString());
    }

    // Start render process
    const renderProcess = spawn("npx", args, {
      cwd: absoluteRemotionPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false, // Important: don't use shell to avoid injection
    });

    const job: RenderJob = {
      id: exportId,
      projectId,
      process: renderProcess,
      progress: 0,
      outputPath,
    };

    this.jobs.set(exportId, job);

    // Parse progress from stderr (Remotion outputs progress there)
    renderProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      console.log(`[Render ${exportId}] ${output}`);

      // Parse progress percentage
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10);
        job.progress = progress;
        this.emit("progress", exportId, progress);
      }
    });

    renderProcess.stdout?.on("data", (data) => {
      console.log(`[Render ${exportId}] ${data.toString()}`);
    });

    renderProcess.on("error", (error) => {
      console.error(`Render process error for ${exportId}:`, error);
      this.emit("error", exportId, error.message);
      this.jobs.delete(exportId);
    });

    renderProcess.on("exit", (code, signal) => {
      if (code === 0) {
        console.log(`Render ${exportId} completed successfully`);
        this.emit("completed", exportId, outputPath);
      } else {
        console.error(`Render ${exportId} failed with code ${code}, signal ${signal}`);
        this.emit("error", exportId, `Render failed with exit code ${code}`);
      }
      this.jobs.delete(exportId);
    });

    console.log(`Started render job ${exportId} for project ${projectId}`);
    this.emit("started", exportId);

    return outputPath;
  }

  // Cancel a render job
  cancelRender(exportId: string): boolean {
    const job = this.jobs.get(exportId);
    if (!job) {
      return false;
    }

    job.process.kill("SIGTERM");
    this.jobs.delete(exportId);
    console.log(`Cancelled render job ${exportId}`);
    this.emit("cancelled", exportId);

    return true;
  }

  // Get progress of a render job
  getProgress(exportId: string): number | null {
    return this.jobs.get(exportId)?.progress ?? null;
  }

  // Check if a render job is running
  isRendering(exportId: string): boolean {
    return this.jobs.has(exportId);
  }

  // Stop all render jobs (for shutdown)
  stopAll(): void {
    for (const [exportId, job] of this.jobs) {
      job.process.kill("SIGTERM");
      console.log(`Stopped render job ${exportId} during shutdown`);
    }
    this.jobs.clear();
  }
}

// Export singleton instance
export const videoRenderer = new VideoRenderer();
