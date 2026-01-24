import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync } from "fs";
import { basename, join } from "path";
import { db } from "@/lib/db";
import { projectIdSchema } from "@/lib/validators/project";
import { getExportsPath, getRemotionPath } from "@/lib/remotion/project-init";

type RouteContext = {
  params: Promise<{ id: string; exportId: string }>;
};

// Try to find the export file in various locations
function findExportFile(outputPath: string, projectId: string): string | null {
  // Try the stored path first
  if (existsSync(outputPath)) {
    return outputPath;
  }

  // Get the filename from the stored path
  const fileName = basename(outputPath);

  // Try the correct exports path
  const correctExportsPath = getExportsPath(projectId);
  const correctPath = join(correctExportsPath, fileName);
  if (existsSync(correctPath)) {
    return correctPath;
  }

  // Try the nested path (old bug location)
  const remotionPath = getRemotionPath(projectId);
  const nestedPath = join(remotionPath, "projects", projectId, "exports", fileName);
  if (existsSync(nestedPath)) {
    return nestedPath;
  }

  // Try inside remotion/out folder
  const outPath = join(remotionPath, "out", fileName);
  if (existsSync(outPath)) {
    return outPath;
  }

  return null;
}

// GET /api/projects/[id]/export/[exportId]/download - Download an export
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id, exportId } = await context.params;

    // Validate project ID
    const validationResult = projectIdSchema.safeParse({ id });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    // Find the export record
    const exportRecord = await db.export.findFirst({
      where: {
        id: exportId,
        projectId: id,
      },
    });

    if (!exportRecord) {
      return NextResponse.json(
        { error: "Export not found" },
        { status: 404 }
      );
    }

    if (exportRecord.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Export is not completed yet" },
        { status: 400 }
      );
    }

    if (!exportRecord.outputPath) {
      return NextResponse.json(
        { error: "Export file path not found" },
        { status: 404 }
      );
    }

    // Try to find the file in various locations
    const actualPath = findExportFile(exportRecord.outputPath, id);

    if (!actualPath) {
      console.error(`Export file not found. Tried paths for: ${exportRecord.outputPath}`);
      return NextResponse.json(
        { error: "Export file not found on disk" },
        { status: 404 }
      );
    }

    // Get file stats
    const stats = statSync(actualPath);
    const fileName = basename(actualPath);

    // Determine content type based on format
    const contentTypes: Record<string, string> = {
      MP4: "video/mp4",
      WEBM: "video/webm",
      GIF: "image/gif",
    };
    const contentType = contentTypes[exportRecord.format] || "application/octet-stream";

    // Read the file and return it
    const fileBuffer = await import("fs/promises").then((fs) =>
      fs.readFile(actualPath)
    );

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": stats.size.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to download export:", error);
    return NextResponse.json(
      { error: "Failed to download export" },
      { status: 500 }
    );
  }
}
