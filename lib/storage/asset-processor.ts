import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { join, dirname } from "path";
import { mkdir, writeFile, unlink } from "fs/promises";
import ffmpegPath from "ffmpeg-static";
import {
  getAssetType,
  MIME_TO_EXTENSION,
  type AssetType,
} from "@/lib/validators/asset";

const execFileAsync = promisify(execFile);

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  bitrate?: number;
  format?: string;
}

export interface ProcessedAsset {
  metadata: AssetMetadata;
  thumbnailPath: string | null;
}

// Generate thumbnail for an image
async function processImage(
  filePath: string,
  thumbnailDir: string,
  storedName: string
): Promise<ProcessedAsset> {
  const thumbnailPath = join(thumbnailDir, `${storedName}_thumb.jpg`);

  // Get image metadata
  const metadata = await sharp(filePath).metadata();

  // Generate thumbnail (200x200 max, preserve aspect ratio)
  await sharp(filePath)
    .resize(200, 200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  return {
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    },
    thumbnailPath,
  };
}

// Generate thumbnail for a video and extract metadata
async function processVideo(
  filePath: string,
  thumbnailDir: string,
  storedName: string
): Promise<ProcessedAsset> {
  const thumbnailPath = join(thumbnailDir, `${storedName}_thumb.jpg`);

  // Get ffprobe path (same directory as ffmpeg)
  const ffprobePath = ffmpegPath?.replace("ffmpeg", "ffprobe") || "ffprobe";

  // Extract metadata using ffprobe (safe: using execFile with array args)
  let metadata: AssetMetadata = {};
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    const probeData = JSON.parse(stdout);
    const videoStream = probeData.streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video"
    );

    if (videoStream) {
      metadata = {
        width: videoStream.width,
        height: videoStream.height,
        duration: parseFloat(probeData.format?.duration || "0"),
        bitrate: parseInt(probeData.format?.bit_rate || "0", 10),
        format: probeData.format?.format_name,
      };
    }
  } catch (error) {
    console.error("Failed to extract video metadata:", error);
  }

  // Extract thumbnail at 1 second mark (safe: using execFile with array args)
  try {
    await execFileAsync(ffmpegPath!, [
      "-i",
      filePath,
      "-ss",
      "00:00:01",
      "-vframes",
      "1",
      "-vf",
      "scale=200:-1",
      "-q:v",
      "2",
      "-y",
      thumbnailPath,
    ]);
  } catch (error) {
    console.error("Failed to generate video thumbnail:", error);
    return { metadata, thumbnailPath: null };
  }

  return { metadata, thumbnailPath };
}

// Extract audio metadata
async function processAudio(
  filePath: string,
  thumbnailDir: string,
  storedName: string
): Promise<ProcessedAsset> {
  // Get ffprobe path
  const ffprobePath = ffmpegPath?.replace("ffmpeg", "ffprobe") || "ffprobe";

  let metadata: AssetMetadata = {};
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ]);

    const probeData = JSON.parse(stdout);

    metadata = {
      duration: parseFloat(probeData.format?.duration || "0"),
      bitrate: parseInt(probeData.format?.bit_rate || "0", 10),
      format: probeData.format?.format_name,
    };
  } catch (error) {
    console.error("Failed to extract audio metadata:", error);
  }

  // Audio files don't have thumbnails
  return { metadata, thumbnailPath: null };
}

// Process font file (minimal metadata)
async function processFont(
  filePath: string,
  thumbnailDir: string,
  storedName: string
): Promise<ProcessedAsset> {
  // Fonts don't have thumbnails or much metadata
  return {
    metadata: { format: "font" },
    thumbnailPath: null,
  };
}

// Main asset processor function
export async function processAsset(
  filePath: string,
  mimeType: string,
  thumbnailDir: string,
  storedName: string
): Promise<ProcessedAsset> {
  // Ensure thumbnail directory exists
  await mkdir(thumbnailDir, { recursive: true });

  const assetType = getAssetType(mimeType);

  switch (assetType) {
    case "image":
      return processImage(filePath, thumbnailDir, storedName);
    case "video":
      return processVideo(filePath, thumbnailDir, storedName);
    case "audio":
      return processAudio(filePath, thumbnailDir, storedName);
    case "font":
      return processFont(filePath, thumbnailDir, storedName);
    default:
      return { metadata: {}, thumbnailPath: null };
  }
}
