import { z } from "zod";

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];

export const ALLOWED_FONT_TYPES = [
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/font-woff",
  "application/font-woff2",
];

export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_FONT_TYPES,
];

// File extensions mapping
export const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "font/ttf": ".ttf",
  "font/otf": ".otf",
  "font/woff": ".woff",
  "font/woff2": ".woff2",
  "application/x-font-ttf": ".ttf",
  "application/x-font-otf": ".otf",
  "application/font-woff": ".woff",
  "application/font-woff2": ".woff2",
};

// Max file size: 2GB
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

// Asset type enum
export type AssetType = "image" | "video" | "audio" | "font";

// Get asset type from MIME type
export function getAssetType(mimeType: string): AssetType | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "video";
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return "audio";
  if (ALLOWED_FONT_TYPES.includes(mimeType)) return "font";
  return null;
}

// Validate file
export function validateFile(
  file: File
): { valid: true } | { valid: false; error: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  // Check MIME type
  if (!ALL_ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { valid: true };
}

// Sanitize filename
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const name = filename.split("/").pop()?.split("\\").pop() || filename;

  // Remove special characters except dots, hyphens, and underscores
  return name
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
}

// Asset upload schema
export const assetUploadSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
});
