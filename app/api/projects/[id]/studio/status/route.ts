import { NextRequest, NextResponse } from "next/server";
import { remotionProcessManager } from "@/lib/remotion/process-manager";
import http from "http";

// Check if studio server is actually responding
function checkStudioReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path: "/",
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        // Got a response, studio is ready
        res.destroy(); // Don't need to read the body
        resolve(true);
      }
    );

    req.on("error", () => {
      resolve(false);
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Try to find a running studio on common ports
async function findRunningStudioPort(): Promise<number | null> {
  const portsToCheck = [3001, 3002, 3003, 3004, 3005];

  for (const port of portsToCheck) {
    const isReady = await checkStudioReady(port);
    if (isReady) {
      return port;
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  // First try to get port from process manager
  let port = remotionProcessManager.getStudioPort(projectId);
  let running = remotionProcessManager.isRunning(projectId);
  let ready = false;

  // If process manager says it's running, check if it's actually ready
  if (running && port) {
    ready = await checkStudioReady(port);
  }

  // If not found via process manager, scan common ports
  // (handles case where API route has different module instance)
  if (!ready) {
    const foundPort = await findRunningStudioPort();
    if (foundPort) {
      port = foundPort;
      running = true;
      ready = true;
    }
  }

  console.log(`Studio status check for ${projectId}: port=${port}, running=${running}, ready=${ready}`);

  return NextResponse.json({
    running,
    port,
    ready,
  });
}
