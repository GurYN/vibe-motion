import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

interface ProjectInitOptions {
  projectId: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

// Get the projects root directory
function getProjectsRoot(): string {
  return process.env.PROJECTS_ROOT || join(process.cwd(), "projects");
}

// Generate the package.json for a Remotion project
function generatePackageJson(name: string): string {
  return JSON.stringify(
    {
      name: name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      private: true,
      scripts: {
        studio: "remotion studio",
        render: "remotion render Main out/video.mp4",
        upgrade: "remotion upgrade",
      },
      dependencies: {
        "@remotion/cli": "^4.0.0",
        "@remotion/player": "^4.0.0",
        react: "^18.3.0",
        "react-dom": "^18.3.0",
        remotion: "^4.0.0",
      },
      devDependencies: {
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        typescript: "^5.0.0",
      },
    },
    null,
    2,
  );
}

// Generate tsconfig.json for a Remotion project
function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        isolatedModules: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules"],
    },
    null,
    2,
  );
}

// Generate remotion.config.ts
function generateRemotionConfig(): string {
  return `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;
}

// Generate the index.ts entry point
function generateIndexTs(): string {
  return `import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
`;
}

// Generate the Root.tsx with compositions list
function generateRootTsx(
  width: number,
  height: number,
  fps: number,
  durationInFrames: number,
): string {
  return `import { Composition } from "remotion";
import { Main } from "./compositions/Main";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={${durationInFrames}}
        fps={${fps}}
        width={${width}}
        height={${height}}
      />
    </>
  );
};
`;
}

// Generate the Main.tsx composition
function generateMainComposition(
  width: number,
  height: number,
  name: string,
): string {
  return `import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 30, durationInFrames - 30, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <h1
          style={{
            fontSize: 72,
            fontWeight: "bold",
            color: "white",
            fontFamily: "system-ui, sans-serif",
            margin: 0,
          }}
        >
          ${name}
        </h1>
        <p
          style={{
            fontSize: 24,
            color: "#888",
            fontFamily: "system-ui, sans-serif",
            margin: 0,
          }}
        >
          Created with Vibe Motion
        </p>
        <p
          style={{
            fontSize: 18,
            color: "#666",
            fontFamily: "monospace",
            margin: 0,
          }}
        >
          Frame {frame} / {durationInFrames} @ {fps}fps
        </p>
      </div>
    </AbsoluteFill>
  );
};
`;
}

// Initialize a new Remotion project
export async function initializeRemotionProject(
  options: ProjectInitOptions,
): Promise<string> {
  const { projectId, name, width, height, fps, durationInFrames } = options;
  const projectsRoot = getProjectsRoot();
  const projectPath = join(projectsRoot, projectId);
  const remotionPath = join(projectPath, "remotion");
  const exportsPath = join(projectPath, "exports");

  // Create directory structure
  await mkdir(join(remotionPath, "src", "compositions"), { recursive: true });
  await mkdir(join(remotionPath, "public"), { recursive: true });
  await mkdir(exportsPath, { recursive: true });

  // Write configuration files
  await writeFile(
    join(remotionPath, "package.json"),
    generatePackageJson(name),
  );
  await writeFile(join(remotionPath, "tsconfig.json"), generateTsConfig());
  await writeFile(
    join(remotionPath, "remotion.config.ts"),
    generateRemotionConfig(),
  );

  // Write source files
  await writeFile(join(remotionPath, "src", "index.ts"), generateIndexTs());
  await writeFile(
    join(remotionPath, "src", "Root.tsx"),
    generateRootTsx(width, height, fps, durationInFrames),
  );
  await writeFile(
    join(remotionPath, "src", "compositions", "Main.tsx"),
    generateMainComposition(width, height, name),
  );

  // Write CLAUDE.md to guide Claude Code
  await writeFile(
    join(remotionPath, "CLAUDE.md"),
    generateClaudeMd(name, width, height, fps, durationInFrames),
  );

  return projectPath;
}

// Get the path to a project's Remotion folder
export function getRemotionPath(projectId: string): string {
  const projectsRoot = getProjectsRoot();
  return join(projectsRoot, projectId, "remotion");
}

// Get the path to a project's exports folder
export function getExportsPath(projectId: string): string {
  const projectsRoot = getProjectsRoot();
  return join(projectsRoot, projectId, "exports");
}

// Get the path to a project's assets (public) folder
export function getAssetsPath(projectId: string): string {
  const projectsRoot = getProjectsRoot();
  return join(projectsRoot, projectId, "remotion", "public");
}

// Generate CLAUDE.md to guide Claude Code on how to work with the project
function generateClaudeMd(
  name: string,
  width: number,
  height: number,
  fps: number,
  durationInFrames: number,
): string {
  return `# ${name} - Remotion Project

## Project Overview

This is a Remotion video project created with Vibe Motion. Use this file to understand how to work with this project.

## Video Configuration

- **Resolution**: ${width}x${height}
- **Frame Rate**: ${fps} fps
- **Duration**: ${durationInFrames} frames (${(durationInFrames / fps).toFixed(1)} seconds)

## Project Structure

\`\`\`
src/
├── index.ts          # Entry point (do not modify)
├── Root.tsx          # Composition registry
└── compositions/
    └── Main.tsx      # Main composition (edit this!)
public/               # Static assets (images, videos, audio, fonts)
\`\`\`

## Important Guidelines

### Use the Main Composition

**ALWAYS modify the existing \`Main.tsx\` composition** unless the user explicitly asks for a new composition.

- The Main composition is the default and primary composition
- Add your animations, scenes, and effects directly to \`Main.tsx\`
- Use Remotion's \`Sequence\` component to organize multiple scenes within Main

### Creating New Compositions (Only When Asked)

If the user explicitly requests a new composition:
1. Create a new file in \`src/compositions/\`
2. Register it in \`src/Root.tsx\`
3. Inform the user which composition to select in the Studio

### Working with Assets

Assets in the \`public/\` folder can be referenced using \`staticFile()\`:

\`\`\`typescript
import { staticFile, Img, Video, Audio } from 'remotion';

// Images
<Img src={staticFile('image.png')} />

// Videos
<Video src={staticFile('video.mp4')} />

// Audio
<Audio src={staticFile('music.mp3')} />
\`\`\`

### Animation Best Practices

1. **Use \`interpolate()\`** for smooth animations:
\`\`\`typescript
import { interpolate, useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1]);
\`\`\`

2. **Use \`spring()\`** for natural motion:
\`\`\`typescript
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const scale = spring({ frame, fps, config: { damping: 10 } });
\`\`\`

3. **Use \`Sequence\`** to organize scenes:
\`\`\`typescript
import { Sequence } from 'remotion';

<Sequence from={0} durationInFrames={60}>
  <IntroScene />
</Sequence>
<Sequence from={60} durationInFrames={90}>
  <MainContent />
</Sequence>
\`\`\`

4. **Use \`AbsoluteFill\`** for full-frame layouts:
\`\`\`typescript
import { AbsoluteFill } from 'remotion';

<AbsoluteFill style={{ backgroundColor: '#000' }}>
  {/* Content */}
</AbsoluteFill>
\`\`\`

### Rendering

To render the video, the user will use the Export button in Vibe Motion, or run:
\`\`\`bash
npm run render
\`\`\`

## Remotion Documentation

For more information, refer to:
- [Remotion Docs](https://www.remotion.dev/docs)
- [Animation Guide](https://www.remotion.dev/docs/animating-properties)
- [Audio/Video](https://www.remotion.dev/docs/video)
`;
}
