import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createProjectSchema } from "@/lib/validators/project";
import { initializeRemotionProject } from "@/lib/remotion/project-init";
import { v4 as uuid } from "uuid";
import { join } from "path";

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        folderPath: true,
        width: true,
        height: true,
        fps: true,
        durationInFrames: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assets: true,
            exports: true,
          },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = createProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, width, height, fps, durationInFrames } =
      validationResult.data;

    // Generate project ID
    const projectId = uuid();
    const projectsRoot = process.env.PROJECTS_ROOT || join(process.cwd(), "projects");
    const folderPath = join(projectsRoot, projectId);

    // Initialize Remotion project folder structure
    await initializeRemotionProject({
      projectId,
      name,
      width,
      height,
      fps,
      durationInFrames,
    });

    // Create database record
    const project = await db.project.create({
      data: {
        id: projectId,
        name,
        description,
        folderPath,
        width,
        height,
        fps,
        durationInFrames,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
