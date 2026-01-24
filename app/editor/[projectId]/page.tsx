"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ArrowLeft, Film, Settings, Download, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { AssetDropzone } from "@/components/editor/asset-dropzone";
import { AssetList } from "@/components/editor/asset-list";
import { ExportDialog } from "@/components/editor/export-dialog";
import { SettingsDialog } from "@/components/editor/settings-dialog";

// Dynamically import Terminal to avoid SSR issues with xterm.js
const Terminal = dynamic(
  () => import("@/components/editor/terminal").then((mod) => mod.Terminal),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a0a0a] rounded-lg flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// Dynamically import PreviewStudio to avoid SSR issues
const PreviewStudio = dynamic(
  () => import("@/components/editor/preview-studio").then((mod) => mod.PreviewStudio),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface Project {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}


export default function EditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [terminalReady, setTerminalReady] = useState(false);
  const [assetRefreshTrigger, setAssetRefreshTrigger] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setProject(data.project);
        }
      } catch (error) {
        console.error("Failed to fetch project:", error);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleAssetUploadComplete = useCallback(() => {
    setAssetRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleTerminalReady = useCallback(() => {
    setTerminalReady(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground">Project not found</div>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <span className="font-semibold">{project.name}</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">
              {project.width}x{project.height}
            </Badge>
            <Badge variant="secondary">{project.fps} fps</Badge>
          </div>
          {terminalReady && (
            <Badge variant="outline" className="text-green-500 border-green-500">
              Connected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      {/* Main Editor Area - Resizable Panels */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
      >
        {/* Left Panel - Assets & Terminal */}
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          maxSize={50}
          className="flex flex-col"
        >
          <ResizablePanelGroup direction="vertical">
            {/* Assets Section */}
            <ResizablePanel
              defaultSize={40}
              minSize={20}
              className="flex flex-col overflow-hidden"
            >
              <div className="p-4 flex flex-col h-full min-h-0">
                <h3 className="font-semibold mb-2 flex-shrink-0">Assets</h3>
                <div className="flex-shrink-0">
                  <AssetDropzone
                    projectId={projectId}
                    onUploadComplete={handleAssetUploadComplete}
                  />
                </div>
                <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
                  <AssetList
                    projectId={projectId}
                    refreshTrigger={assetRefreshTrigger}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Terminal Section */}
            <ResizablePanel
              defaultSize={60}
              minSize={30}
              className="flex flex-col overflow-hidden"
            >
              <div className="p-4 flex flex-col h-full overflow-hidden">
                <h3 className="font-semibold mb-2 flex-shrink-0">Terminal</h3>
                <div className="flex-1 min-h-0">
                  <Terminal
                    projectId={projectId}
                    onReady={handleTerminalReady}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Preview */}
        <ResizablePanel
          defaultSize={70}
          minSize={40}
          className="flex flex-col overflow-hidden"
        >
          {/* Preview Area */}
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <PreviewStudio
              projectId={projectId}
              width={project.width}
              height={project.height}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Export Dialog */}
      <ExportDialog
        projectId={projectId}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        project={project}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onProjectUpdate={setProject}
      />
    </div>
  );
}
