"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, Check, Loader2, FileImage, FileVideo, FileAudio, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssetDropzoneProps {
  projectId: string;
  onUploadComplete?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
];

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  return FileType;
}

export function AssetDropzone({ projectId, onUploadComplete }: AssetDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 2GB limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type ${file.type || "unknown"} is not supported`;
    }
    return null;
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      // Filter valid files
      const validFiles = files.filter((file) => !validateFile(file));
      const invalidFiles = files.filter((file) => validateFile(file));

      // Add to uploading list
      const newUploadingFiles: UploadingFile[] = [
        ...validFiles.map((file) => ({
          file,
          progress: 0,
          status: "pending" as const,
        })),
        ...invalidFiles.map((file) => ({
          file,
          progress: 0,
          status: "error" as const,
          error: validateFile(file) || "Unknown error",
        })),
      ];

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      // Upload valid files
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        setUploadingFiles((prev) =>
          prev.map((uf) =>
            uf.file === file ? { ...uf, status: "uploading" as const } : uf
          )
        );

        try {
          const formData = new FormData();
          formData.append("files", file);

          const response = await fetch(`/api/projects/${projectId}/assets`, {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            setUploadingFiles((prev) =>
              prev.map((uf) =>
                uf.file === file
                  ? { ...uf, status: "complete" as const, progress: 100 }
                  : uf
              )
            );
          } else {
            const data = await response.json();
            setUploadingFiles((prev) =>
              prev.map((uf) =>
                uf.file === file
                  ? {
                      ...uf,
                      status: "error" as const,
                      error: data.error || "Upload failed",
                    }
                  : uf
              )
            );
          }
        } catch {
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.file === file
                ? { ...uf, status: "error" as const, error: "Upload failed" }
                : uf
            )
          );
        }
      }

      // Clear completed uploads after a delay
      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((uf) => uf.status !== "complete")
        );
        onUploadComplete?.();
      }, 2000);
    },
    [projectId, validateFile, onUploadComplete]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadFiles(files);
      }
    },
    [uploadFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        uploadFiles(files);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [uploadFiles]
  );

  const removeFile = useCallback((file: File) => {
    setUploadingFiles((prev) => prev.filter((uf) => uf.file !== file));
  }, []);

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileSelect}
        />
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragging ? "Drop files here" : "Drag & drop or click to upload"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, videos, audio, fonts (max 2GB)
        </p>
      </div>

      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf, index) => {
            const Icon = getFileIcon(uf.file.type);
            return (
              <div
                key={`${uf.file.name}-${index}`}
                className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{uf.file.name}</span>
                {uf.status === "pending" && (
                  <span className="text-muted-foreground">Waiting...</span>
                )}
                {uf.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {uf.status === "complete" && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {uf.status === "error" && (
                  <>
                    <span className="text-destructive text-xs truncate max-w-[100px]">
                      {uf.error}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(uf.file)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
