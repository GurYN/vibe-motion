"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, FileImage, FileVideo, FileAudio, FileType, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Asset {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  fileSize: number;
  thumbnailPath: string | null;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
  } | null;
}

interface AssetListProps {
  projectId: string;
  refreshTrigger?: number;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  return FileType;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AssetList({ projectId, refreshTrigger }: AssetListProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, refreshTrigger]);

  const deleteAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/${assetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const copyFilename = async (storedName: string) => {
    await navigator.clipboard.writeText(storedName);
    setCopiedId(storedName);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Loading assets...
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No assets uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {assets.map((asset) => {
        const Icon = getFileIcon(asset.mimeType);
        return (
          <div
            key={asset.id}
            className="group flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors"
          >
            {/* Icon or thumbnail */}
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" title={asset.storedName}>
                {asset.storedName}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(asset.fileSize)}</span>
                {asset.metadata?.width && asset.metadata?.height && (
                  <span>
                    {asset.metadata.width}x{asset.metadata.height}
                  </span>
                )}
                {asset.metadata?.duration && (
                  <span>{formatDuration(asset.metadata.duration)}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => copyFilename(asset.storedName)}
                title="Copy filename"
              >
                {copiedId === asset.storedName ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete asset"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Asset</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{asset.filename}&quot;?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAsset(asset.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}
