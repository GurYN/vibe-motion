// Project-related types

export interface ProjectConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface ProjectWithConfig {
  id: string;
  name: string;
  description: string | null;
  folderPath: string;
  config: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames?: number;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames?: number;
}

// Asset types
export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  bitrate?: number;
  format?: string;
}

export interface AssetWithMetadata {
  id: string;
  projectId: string;
  filename: string;
  storedName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  thumbnailPath: string | null;
  metadata: AssetMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}
