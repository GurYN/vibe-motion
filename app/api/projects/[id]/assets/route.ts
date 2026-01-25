import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, access } from "fs/promises";
import { join, parse as parsePath } from "path";
import { db } from "@/lib/db";
import { projectIdSchema } from "@/lib/validators/project";
import {
  sanitizeFilename,
  MAX_FILE_SIZE,
  ALL_ALLOWED_TYPES,
} from "@/lib/validators/asset";
import { processAsset } from "@/lib/storage/asset-processor";
import { getAssetsPath } from "@/lib/remotion/project-init";

// Allow large file uploads (2GB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2gb",
    },
    responseLimit: false,
  },
};

// Check if file exists
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Get unique filename if file already exists
async function getUniqueFilename(dir: string, filename: string): Promise<string> {
  const { name, ext } = parsePath(filename);
  let finalName = filename;
  let counter = 1;

  while (await fileExists(join(dir, finalName))) {
    finalName = `${name}_${counter}${ext}`;
    counter++;
  }

  return finalName;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/projects/[id]/assets - List assets for a project
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

    const assets = await db.asset.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/assets - Upload asset(s)
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Get paths
    const assetsPath = getAssetsPath(id);
    const thumbnailDir = join(assetsPath, ".thumbnails");

    // Ensure directories exist
    await mkdir(assetsPath, { recursive: true });
    await mkdir(thumbnailDir, { recursive: true });

    const uploadedAssets = [];
    const errors = [];

    for (const file of files) {
      // Validate file on server side
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: file.name,
          error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        });
        continue;
      }

      if (!ALL_ALLOWED_TYPES.includes(file.type)) {
        errors.push({
          filename: file.name,
          error: `File type ${file.type} is not allowed`,
        });
        continue;
      }

      try {
        // Keep original filename (sanitized) for easy reference
        const sanitizedName = sanitizeFilename(file.name);
        const storedFilename = await getUniqueFilename(assetsPath, sanitizedName);
        const filePath = join(assetsPath, storedFilename);

        // Write file to disk
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        // Process asset (generate thumbnail, extract metadata)
        // Use filename without extension as the base name for thumbnail
        const { name: baseName } = parsePath(storedFilename);
        const { metadata, thumbnailPath } = await processAsset(
          filePath,
          file.type,
          thumbnailDir,
          baseName
        );

        // Create database record
        const asset = await db.asset.create({
          data: {
            projectId: id,
            filename: sanitizeFilename(file.name),
            storedName: storedFilename,
            mimeType: file.type,
            fileSize: file.size,
            filePath,
            thumbnailPath,
            metadata: metadata as object,
          },
        });

        uploadedAssets.push(asset);
      } catch (fileError) {
        console.error(`Failed to process file ${file.name}:`, fileError);
        errors.push({
          filename: file.name,
          error: "Failed to process file",
        });
      }
    }

    return NextResponse.json(
      {
        assets: uploadedAssets,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: uploadedAssets.length > 0 ? 201 : 400 }
    );
  } catch (error) {
    console.error("Failed to upload assets:", error);
    return NextResponse.json(
      { error: "Failed to upload assets" },
      { status: 500 }
    );
  }
}
