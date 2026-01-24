import { watch, type FSWatcher } from "chokidar";
import { EventEmitter } from "events";
import { join } from "path";

class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();

  // Start watching a project's source files
  startWatching(projectId: string, remotionPath: string): void {
    // Don't watch the same project twice
    if (this.watchers.has(projectId)) {
      return;
    }

    const srcPath = join(remotionPath, "src");

    const watcher = watch(srcPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    watcher
      .on("add", (path) => {
        console.log(`File added: ${path}`);
        this.emit("change", projectId, path, "add");
      })
      .on("change", (path) => {
        console.log(`File changed: ${path}`);
        this.emit("change", projectId, path, "change");
      })
      .on("unlink", (path) => {
        console.log(`File removed: ${path}`);
        this.emit("change", projectId, path, "unlink");
      })
      .on("error", (error) => {
        console.error(`Watcher error for project ${projectId}:`, error);
      });

    this.watchers.set(projectId, watcher);
    console.log(`Started watching ${srcPath} for project ${projectId}`);
  }

  // Stop watching a project
  stopWatching(projectId: string): void {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
      console.log(`Stopped watching project ${projectId}`);
    }
  }

  // Stop all watchers
  stopAll(): void {
    for (const [projectId, watcher] of this.watchers) {
      watcher.close();
      console.log(`Stopped watching project ${projectId}`);
    }
    this.watchers.clear();
  }

  // Check if a project is being watched
  isWatching(projectId: string): boolean {
    return this.watchers.has(projectId);
  }
}

// Export singleton instance
export const fileWatcher = new FileWatcher();
