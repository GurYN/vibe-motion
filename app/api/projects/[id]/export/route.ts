import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { db } from "@/lib/db";
import { projectIdSchema } from "@/lib/validators/project";
import {
  createExportSchema,
  validateCodecForFormat,
} from "@/lib/validators/export";
import { videoRenderer } from "@/lib/remotion/renderer";
import { getRemotionPath, getExportsPath } from "@/lib/remotion/project-init";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/projects/[id]/export - List exports for a project
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const validationResult = projectIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const exports = await db.export.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ exports });
  } catch (error) {
    console.error("Failed to fetch exports:", error);
    return NextResponse.json(
      { error: "Failed to fetch exports" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/export - Start a new export
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idValidation = projectIdSchema.safeParse({ id });

    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    // Check if project exists
    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createExportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { compositionId, format, quality } = validationResult.data;

    // Validate and get codec
    const codec = validateCodecForFormat(format, validationResult.data.codec);

    // Create export record
    const exportRecord = await db.export.create({
      data: {
        projectId: id,
        compositionId,
        format,
        codec,
        quality,
        status: "PENDING",
      },
    });

    // Get paths
    const remotionPath = getRemotionPath(id);
    const exportsPath = getExportsPath(id);

    // Start render job (async)
    videoRenderer
      .startRender(exportRecord.id, id, remotionPath, exportsPath, {
        compositionId,
        format,
        codec,
        quality,
      })
      .then(async (outputPath) => {
        // Update export with output path
        await db.export.update({
          where: { id: exportRecord.id },
          data: {
            outputPath,
            status: "RENDERING",
            startedAt: new Date(),
          },
        });
      })
      .catch(async (error) => {
        // Update export with error
        await db.export.update({
          where: { id: exportRecord.id },
          data: {
            status: "FAILED",
            errorMessage: error.message,
          },
        });
      });

    // Set up progress and completion handlers for this export
    const progressHandler = async (exportId: string, progress: number) => {
      if (exportId === exportRecord.id) {
        await db.export.update({
          where: { id: exportId },
          data: { progress },
        });
      }
    };

    const completedHandler = async (exportId: string, outputPath: string) => {
      if (exportId === exportRecord.id) {
        // Get file size
        const fs = await import("fs/promises");
        let fileSize = 0;
        try {
          const stats = await fs.stat(outputPath);
          fileSize = stats.size;
        } catch {
          // Ignore if file doesn't exist
        }

        await db.export.update({
          where: { id: exportId },
          data: {
            status: "COMPLETED",
            progress: 100,
            completedAt: new Date(),
            fileSize,
          },
        });

        // Clean up handlers
        videoRenderer.off("progress", progressHandler);
        videoRenderer.off("completed", completedHandler);
        videoRenderer.off("error", errorHandler);
      }
    };

    const errorHandler = async (exportId: string, errorMessage: string) => {
      if (exportId === exportRecord.id) {
        await db.export.update({
          where: { id: exportId },
          data: {
            status: "FAILED",
            errorMessage,
          },
        });

        // Clean up handlers
        videoRenderer.off("progress", progressHandler);
        videoRenderer.off("completed", completedHandler);
        videoRenderer.off("error", errorHandler);
      }
    };

    videoRenderer.on("progress", progressHandler);
    videoRenderer.on("completed", completedHandler);
    videoRenderer.on("error", errorHandler);

    return NextResponse.json({ export: exportRecord }, { status: 202 });
  } catch (error) {
    console.error("Failed to start export:", error);
    return NextResponse.json(
      { error: "Failed to start export" },
      { status: 500 }
    );
  }
}
