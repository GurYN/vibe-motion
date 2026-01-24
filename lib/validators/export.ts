import { z } from "zod";

// Export format enum
export const exportFormatSchema = z.enum(["MP4", "WEBM", "GIF"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

// Codec mapping per format
export const FORMAT_CODECS: Record<ExportFormat, string[]> = {
  MP4: ["h264", "h265"],
  WEBM: ["vp8", "vp9"],
  GIF: ["gif"],
};

// Export creation schema
export const createExportSchema = z.object({
  compositionId: z.string().min(1, "Composition ID is required").default("Main"),
  format: exportFormatSchema.default("MP4"),
  codec: z.string().optional(),
  quality: z.number().int().min(0).max(51).default(18), // CRF value
});

export type CreateExportInput = z.infer<typeof createExportSchema>;

// Validate codec for format
export function validateCodecForFormat(
  format: ExportFormat,
  codec: string | undefined
): string {
  const allowedCodecs = FORMAT_CODECS[format];

  if (!codec) {
    return allowedCodecs[0]; // Default to first codec
  }

  if (!allowedCodecs.includes(codec)) {
    return allowedCodecs[0]; // Fallback to default if invalid
  }

  return codec;
}
