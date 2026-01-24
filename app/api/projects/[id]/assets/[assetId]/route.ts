import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { db } from "@/lib/db";
import { projectIdSchema } from "@/lib/validators/project";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string; assetId: string }>;
};

const paramsSchema = z.object({
  id: z.string().uuid("Invalid project ID"),
  assetId: z.string().uuid("Invalid asset ID"),
});

// GET /api/projects/[id]/assets/[assetId] - Get single asset
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const validationResult = paramsSchema.safeParse(params);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    const { id, assetId } = validationResult.data;

    const asset = await db.asset.findFirst({
      where: {
        id: assetId,
        projectId: id,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Failed to fetch asset:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/assets/[assetId] - Delete asset
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const validationResult = paramsSchema.safeParse(params);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    const { id, assetId } = validationResult.data;

    // Find asset
    const asset = await db.asset.findFirst({
      where: {
        id: assetId,
        projectId: id,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // Delete file from disk
    try {
      await unlink(asset.filePath);
    } catch (fsError) {
      console.warn("Failed to delete asset file:", fsError);
    }

    // Delete thumbnail if exists
    if (asset.thumbnailPath) {
      try {
        await unlink(asset.thumbnailPath);
      } catch (fsError) {
        console.warn("Failed to delete thumbnail:", fsError);
      }
    }

    // Delete from database
    await db.asset.delete({
      where: { id: assetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
