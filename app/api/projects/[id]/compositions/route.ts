import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { projectIdSchema } from "@/lib/validators/project";
import { getRemotionPath } from "@/lib/remotion/project-init";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Extract composition IDs from Root.tsx
async function extractCompositionsFromRoot(remotionPath: string): Promise<string[]> {
  const compositions: string[] = [];

  try {
    const rootPath = join(remotionPath, "src", "Root.tsx");
    const content = await readFile(rootPath, "utf-8");

    // Match Composition id="..." or id='...'
    const idMatches = content.matchAll(/\<Composition[^>]*\bid\s*=\s*["']([^"']+)["']/g);
    for (const match of idMatches) {
      if (match[1]) {
        compositions.push(match[1]);
      }
    }

    // Also match Still id="..." for still images
    const stillMatches = content.matchAll(/\<Still[^>]*\bid\s*=\s*["']([^"']+)["']/g);
    for (const match of stillMatches) {
      if (match[1]) {
        compositions.push(match[1]);
      }
    }
  } catch (error) {
    console.error("Failed to parse Root.tsx:", error);
  }

  return compositions;
}

// Scan compositions folder for additional compositions
async function scanCompositionsFolder(remotionPath: string): Promise<string[]> {
  const compositions: string[] = [];

  try {
    const compositionsPath = join(remotionPath, "src", "compositions");
    const files = await readdir(compositionsPath);

    for (const file of files) {
      if (file.endsWith(".tsx") || file.endsWith(".ts")) {
        // Use filename without extension as potential composition ID
        const name = file.replace(/\.(tsx?|jsx?)$/, "");
        if (name && name !== "index") {
          compositions.push(name);
        }
      }
    }
  } catch (error) {
    // Folder might not exist, that's ok
  }

  return compositions;
}

// GET /api/projects/[id]/compositions - List compositions in a project
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Validate project ID
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

    const remotionPath = getRemotionPath(id);

    // Get compositions from Root.tsx
    const rootCompositions = await extractCompositionsFromRoot(remotionPath);

    // Get compositions from folder (as fallback/additional)
    const folderCompositions = await scanCompositionsFolder(remotionPath);

    // Combine and deduplicate
    const allCompositions = [...new Set([...rootCompositions, ...folderCompositions])];

    // If no compositions found, return "Main" as default
    if (allCompositions.length === 0) {
      allCompositions.push("Main");
    }

    return NextResponse.json({ compositions: allCompositions });
  } catch (error) {
    console.error("Failed to get compositions:", error);
    return NextResponse.json(
      { error: "Failed to get compositions" },
      { status: 500 }
    );
  }
}
