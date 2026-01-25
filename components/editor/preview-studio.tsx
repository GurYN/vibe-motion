"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ExternalLink, Power, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewStudioProps {
  projectId: string;
  width?: number;
  height?: number;
}

export function PreviewStudio({ projectId }: PreviewStudioProps) {
  const [studioPort, setStudioPort] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isWaitingForReady, setIsWaitingForReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mountedRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartedRef = useRef(false);

  // Function to check if studio server is actually responding (via server-side API)
  const checkStudioReady = useCallback(async (): Promise<{ ready: boolean; port: number | null }> => {
    try {
      const res = await fetch(`/api/projects/${projectId}/studio/status`);
      if (res.ok) {
        const data = await res.json();
        return { ready: data.ready === true, port: data.port };
      }
      return { ready: false, port: null };
    } catch {
      return { ready: false, port: null };
    }
  }, [projectId]);

  // Start polling to check if studio is ready
  const startPollingForReady = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsWaitingForReady(true);

    pollingIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        return;
      }

      const { ready, port: currentPort } = await checkStudioReady();
      if (ready && mountedRef.current && currentPort) {
        setIsWaitingForReady(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Update port if needed and set iframe src
        setStudioPort(currentPort);
      }
    }, 1000); // Check every second
  }, [checkStudioReady]);

  // Check if studio is already running on mount
  useEffect(() => {
    mountedRef.current = true;
    autoStartedRef.current = false; // Reset auto-start flag when project changes

    async function checkStudioStatus() {
      try {
        const res = await fetch(`/api/projects/${projectId}/studio/status`);
        if (res.ok && mountedRef.current) {
          const data = await res.json();
          if (data.running && data.port) {
            setStudioPort(data.port);
            // Check if it's actually ready
            if (!data.ready) {
              startPollingForReady();
            }
          }
        }
      } catch (err) {
        console.error("Failed to check studio status:", err);
      } finally {
        if (mountedRef.current) {
          setIsChecking(false);
        }
      }
    }

    checkStudioStatus();

    return () => {
      mountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [projectId, startPollingForReady]);

  // Connect to WebSocket for studio control (only for updates, not session)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Just subscribe to studio events for this project, don't create session
      ws.send(JSON.stringify({ type: "studio:subscribe", projectId }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "studio:started":
            if (mountedRef.current) {
              setStudioPort(message.port);
              setIsStarting(false);
              setError(null);
              // Start polling to check when studio is actually ready
              startPollingForReady();
            }
            break;

          case "studio:stopped":
            if (mountedRef.current) {
              setStudioPort(null);
              setIsWaitingForReady(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            }
            break;

          case "studio:error":
            if (mountedRef.current) {
              setError(message.error);
              setIsStarting(false);
              setIsWaitingForReady(false);
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = () => {
      if (mountedRef.current) {
        setError("WebSocket connection error");
      }
    };

    return () => {
      // Stop the studio when leaving the project
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "studio:stop", projectId }));
      }
      ws.close();
    };
  }, [projectId, startPollingForReady]);

  // Auto-start studio after initial check completes
  useEffect(() => {
    if (!isChecking && !studioPort && !isStarting && !autoStartedRef.current) {
      autoStartedRef.current = true;
      // Wait a moment for WebSocket to connect
      const timeoutId = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && mountedRef.current) {
          setIsStarting(true);
          setError(null);
          wsRef.current.send(JSON.stringify({ type: "studio:start", projectId }));
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isChecking, studioPort, isStarting, projectId]);

  const startStudio = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsStarting(true);
      setError(null);
      wsRef.current.send(JSON.stringify({ type: "studio:start", projectId }));
    }
  }, [projectId]);

  const stopStudio = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "studio:stop", projectId }));
    }
  }, [projectId]);

  const openInNewTab = useCallback(() => {
    if (studioPort) {
      window.open(`http://localhost:${studioPort}`, "_blank");
    }
  }, [studioPort]);

  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  // Checking studio status
  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-muted-foreground">Checking studio status...</p>
      </div>
    );
  }

  // Studio not started - show start button (only if auto-start hasn't been attempted)
  if (!studioPort && !isStarting) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">Remotion Studio</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Launch the full Remotion Studio with timeline, props editor, and
            advanced editing tools.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive mb-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Button onClick={startStudio} size="lg">
          <Power className="mr-2 h-5 w-5" />
          Start Remotion Studio
        </Button>
      </div>
    );
  }

  // Starting studio - show loading
  if (isStarting) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-muted-foreground">Starting Remotion Studio...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Installing dependencies if needed (this may take a minute)...
        </p>
      </div>
    );
  }

  // Waiting for studio to be ready
  if (isWaitingForReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-muted-foreground">Waiting for Remotion Studio to be ready...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Studio is starting on port {studioPort}...
        </p>
      </div>
    );
  }

  // Studio running - show iframe
  return (
    <div className="flex flex-col h-full">
      {/* Studio controls */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">
              Studio running on port {studioPort}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refreshIframe}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={openInNewTab}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Open in Tab
          </Button>
          <Button variant="ghost" size="sm" onClick={stopStudio}>
            <Power className="h-4 w-4 mr-1" />
            Stop
          </Button>
        </div>
      </div>

      {/* Studio iframe - isolated to prevent affecting parent page */}
      <div className="flex-1 bg-black">
        <iframe
          ref={iframeRef}
          src={`http://localhost:${studioPort}`}
          className="w-full h-full border-0"
          title="Remotion Studio"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
