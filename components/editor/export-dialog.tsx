"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

interface ExportDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportRecord {
  id: string;
  compositionId: string;
  format: string;
  codec: string;
  quality: number;
  status: string;
  progress: number;
  outputPath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  createdAt: string;
}

const FORMAT_OPTIONS = [
  { value: "MP4", label: "MP4 (H.264)", description: "Best compatibility" },
  { value: "WEBM", label: "WebM (VP9)", description: "Smaller file size" },
  { value: "GIF", label: "GIF", description: "Animated image" },
];

const CODEC_OPTIONS: Record<string, { value: string; label: string }[]> = {
  MP4: [
    { value: "h264", label: "H.264" },
    { value: "h265", label: "H.265 (HEVC)" },
  ],
  WEBM: [
    { value: "vp8", label: "VP8" },
    { value: "vp9", label: "VP9" },
  ],
  GIF: [{ value: "gif", label: "GIF" }],
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export function ExportDialog({
  projectId,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const [format, setFormat] = useState("MP4");
  const [codec, setCodec] = useState("h264");
  const [quality, setQuality] = useState(18);
  const [compositionId, setCompositionId] = useState("Main");
  const [compositions, setCompositions] = useState<string[]>(["Main"]);
  const [isLoadingCompositions, setIsLoadingCompositions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch compositions list
  const fetchCompositions = useCallback(async () => {
    setIsLoadingCompositions(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/compositions`);
      if (res.ok) {
        const data = await res.json();
        const comps = data.compositions || ["Main"];
        setCompositions(comps);
        // Set first composition as default if current one isn't in the list
        if (comps.length > 0 && !comps.includes(compositionId)) {
          setCompositionId(comps[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch compositions:", error);
    } finally {
      setIsLoadingCompositions(false);
    }
  }, [projectId, compositionId]);

  // Fetch exports list
  const fetchExports = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (res.ok) {
        const data = await res.json();
        setExports(data.exports || []);
      }
    } catch (error) {
      console.error("Failed to fetch exports:", error);
    }
  };

  // Start polling when dialog opens
  useEffect(() => {
    if (open) {
      fetchCompositions();
      fetchExports();
      const interval = setInterval(fetchExports, 2000);
      setPollInterval(interval);
    } else {
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [open, projectId, fetchCompositions]);

  // Update codec when format changes
  useEffect(() => {
    const codecs = CODEC_OPTIONS[format];
    if (codecs && codecs.length > 0) {
      setCodec(codecs[0].value);
    }
  }, [format]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compositionId,
          format,
          codec,
          quality,
        }),
      });

      if (res.ok) {
        fetchExports();
      } else {
        const data = await res.json();
        console.error("Export failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to start export:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "RENDERING":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Export Video</AlertDialogTitle>
          <AlertDialogDescription>
            Configure and start a video export
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-6 py-4">
          {/* Export settings */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Composition</Label>
                <Select
                  value={compositionId}
                  onValueChange={setCompositionId}
                  disabled={isLoadingCompositions}
                >
                  <SelectTrigger>
                    {isLoadingCompositions ? (
                      <span className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </span>
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {compositions.map((comp) => (
                      <SelectItem key={comp} value={comp}>
                        {comp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="codec">Codec</Label>
                <Select value={codec} onValueChange={setCodec}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CODEC_OPTIONS[format]?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quality">
                  Quality (CRF: {quality}) - Lower is better
                </Label>
                <Input
                  id="quality"
                  type="range"
                  min="0"
                  max="51"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Export...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Start Export
                </>
              )}
            </Button>
          </div>

          {/* Export history */}
          {exports.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Export History</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {exports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-3 p-2 bg-muted/50 rounded-md text-sm"
                  >
                    {getStatusIcon(exp.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{exp.compositionId}</span>
                        <Badge variant="secondary" className="text-xs">
                          {exp.format}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(exp.createdAt)}
                        {exp.status === "RENDERING" && ` - ${exp.progress}%`}
                        {exp.status === "COMPLETED" &&
                          ` - ${formatFileSize(exp.fileSize)}`}
                        {exp.status === "FAILED" && exp.errorMessage && (
                          <span className="text-destructive">
                            {" "}
                            - {exp.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                    {exp.status === "COMPLETED" && exp.outputPath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`/api/projects/${projectId}/export/${exp.id}/download`}
                          download
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {exp.status === "RENDERING" && (
                      <div className="w-16 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${exp.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
