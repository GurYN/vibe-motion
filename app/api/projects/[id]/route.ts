import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateProjectSchema, projectIdSchema } from "@/lib/validators/project";
import { rm } from "fs/promises";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/projects/[id] - Get a single project
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

    const project = await db.project.findUnique({
      where: { id },
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
        },
        exports: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        sessions: {
          where: { status: "ACTIVE" },
        },
        _count: {
          select: {
            assets: true,
            exports: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Update a project
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idValidation = projectIdSchema.safeParse({ id });

    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = updateProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Check if project exists
    const existing = await db.project.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Update project
    const project = await db.project.update({
      where: { id },
      data: validationResult.data,
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Partial update a project (alias for PUT)
export async function PATCH(request: NextRequest, context: RouteContext) {
  return PUT(request, context);
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const validationResult = projectIdSchema.safeParse({ id });

    if (!validationResult.success) {
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

    // Delete project folder
    try {
      await rm(project.folderPath, { recursive: true, force: true });
    } catch (fsError) {
      console.warn("Failed to delete project folder:", fsError);
      // Continue with database deletion even if folder deletion fails
    }

    // Delete from database (cascades to assets, sessions, exports)
    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
