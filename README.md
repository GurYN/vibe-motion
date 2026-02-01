# Vibe Motion

**AI-Powered Motion Design Video Creation**

Vibe Motion is a "Vibe Coding" application for motion design video creation. It enables users to create professional videos by describing what they want in natural language, powered by **Claude Code** (Anthropic's AI coding assistant) and **Remotion** (React-based programmatic video framework).

[![Demo Video](assets/youtube.png)](https://www.youtube.com/watch?v=fbp8fcgVluM "Demo Video")

## Features

- **Project Management**
  - Create, edit, and delete projects
  - Configurable resolution presets (1080p, 720p, 4K, Square, Portrait, Custom)
  - Configurable frame rate (24, 25, 30, 50, 60 fps)
  - Project settings dialog

- **Integrated Terminal**
  - Full terminal emulation with xterm.js
  - WebSocket + node-pty for real-time communication
  - Claude Code runs in the context of each project's Remotion folder
  - Session persistence with output buffer for reconnection
  - Auto-start Claude Code when opening a project

- **Asset Management**
  - Drag-and-drop file upload
  - Support for images (PNG, JPG, SVG, GIF, WebP), videos (MP4, WebM, MOV), audio (MP3, WAV, OGG), and fonts (TTF, OTF, WOFF2)
  - Thumbnail generation for images and videos
  - Original filename preservation
  - Copy filename to clipboard for easy use in compositions

- **Remotion Studio Integration**
  - Auto-start Remotion Studio when opening a project
  - Embedded Studio in iframe with full functionality
  - Start/stop controls
  - Open in new tab option
  - Hot reload on file changes

- **Video Export**
  - Multiple formats: MP4 (H.264/H.265), WebM (VP8/VP9), GIF
  - Quality control via CRF value
  - Composition selection from project
  - Progress tracking with real-time updates
  - Export history with download links

- **User Interface**
  - Dark/Light/System theme modes
  - Resizable panels (assets, terminal, preview)
  - Responsive layout
  - shadcn/ui components with Radix Nova style

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16+ (App Router), React 19 |
| **UI** | Tailwind CSS 4, shadcn/ui |
| **Terminal** | xterm.js + WebSocket + node-pty |
| **Video** | Remotion 4, @remotion/player |
| **Database** | PostgreSQL + Prisma |
| **File Processing** | Sharp (images), FFmpeg (videos) |

## Getting Started

### Prerequisites

- Node.js 24+
- PostgreSQL 17+
- Claude Code CLI installed
- Active Claude Pro/Max subscription or Claude AI API key
- FFmpeg (for video thumbnail generation)

### Installation

```bash
# Clone the repository
git clone https://github.com/guryn/vibe-motion.git
cd vibe-motion

# Install dependencies
bun install
# or
npm install

# Run database migrations
npx prisma migrate dev

# Start the development server
bun dev
# or
npm run dev
```

### Environment Variables

Create a `.env` file (or copy `.env.example` as `.env`):

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/vibemotion"

# Server
PORT=3000
HOST="localhost"
NODE_ENV="development"

# Projects folder (optional, defaults to ./projects)
PROJECTS_ROOT="${PWD}/projects"
```

### Troubleshooting

#### Terminal UI Error
If you get this error in terminal UI : `Error: Failed to create terminal session: posix_spawnp failed.`

Fix node-pty permissions (Thank you Marc)
```
chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
```

## Project Structure

```
vibe-motion/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard pages
│   │   └── page.tsx              # Project list
│   ├── api/                      # API routes
│   │   └── projects/             # Project CRUD, assets, exports, studio
│   ├── editor/                   # Editor pages
│   │   └── [projectId]/          # Project editor
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── editor/                   # Editor-specific components
│   │   ├── asset-dropzone.tsx    # Asset upload dropzone
│   │   ├── asset-list.tsx        # Asset gallery
│   │   ├── export-dialog.tsx     # Export configuration
│   │   ├── preview-studio.tsx    # Remotion Studio wrapper
│   │   ├── settings-dialog.tsx   # Project settings
│   │   └── terminal.tsx          # Terminal component
│   ├── ui/                       # shadcn/ui components
│   ├── theme-provider.tsx        # Theme context
│   └── theme-toggle.tsx          # Theme switcher
├── lib/                          # Utilities and services
│   ├── db.ts                     # Prisma client
│   ├── pty/                      # PTY management
│   │   ├── manager.ts            # Session management
│   │   └── security.ts           # Environment sanitization
│   ├── remotion/                 # Remotion utilities
│   │   ├── process-manager.ts    # Studio process management
│   │   ├── project-init.ts       # Project scaffolding
│   │   └── renderer.ts           # Video rendering
│   ├── storage/                  # File handling
│   │   └── asset-processor.ts    # Thumbnails and metadata
│   ├── validators/               # Zod schemas
│   └── websocket/                # WebSocket utilities
│       └── file-watcher.ts       # File change detection
├── prisma/                       # Database
│   └── schema.prisma             # Data model
├── projects/                     # User projects (gitignored)
├── server.ts                     # Custom server with WebSocket
├── types/                        # TypeScript types
└── CLAUDE.md                     # AI assistant instructions
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                            BROWSER                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │   xterm.js     │  │ Remotion       │  │   React UI         │  │
│  │   Terminal     │  │ Studio         │  │   Components       │  │
│  │                │  │ (iframe)       │  │                    │  │
│  └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘  │
│          │ WebSocket         │ HTTP              │ HTTP          │
└──────────┼───────────────────┼───────────────────┼───────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      VIBE MOTION SERVER                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │  WebSocket     │  │  API Routes    │  │  Process Manager   │  │
│  │  Handler       │  │  /api/*        │  │                    │  │
│  └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘  │
│          │                   │                     │             │
│          ▼                   ▼                     ▼             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │   node-pty     │  │    Prisma      │  │  Child Processes   │  │
│  │ (Claude Code)  │  │    Client      │  │  - remotion studio │  │
│  └────────────────┘  └────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
           │                   │                     │
           ▼                   ▼                     ▼
┌──────────────────┐  ┌────────────────┐  ┌────────────────────────┐
│   Claude Code    │  │   PostgreSQL   │  │   Project Folders      │
│   CLI Process    │  │                │  │   /projects/{uuid}/    │
│                  │  │   - Projects   │  │     ├── remotion/      │
│                  │  │   - Assets     │  │     │   ├── src/       │
│                  │  │   - Exports    │  │     │   └── public/    │
│                  │  │   - Sessions   │  │     └── exports/       │
└──────────────────┘  └────────────────┘  └────────────────────────┘
```

## Usage

### Creating a Video

1. **Create a new project** from the dashboard
2. **Upload assets** (images, videos, audio) via drag-and-drop
3. **Use the terminal** to interact with Claude Code:
   ```
   Create a 10-second intro animation with the logo fading in,
   then sliding to the corner while the title appears.
   ```
4. **Preview** your video in the embedded Remotion Studio
5. **Export** when ready - choose format, quality, and composition

### Example Prompts for Claude

```
"Create a presentation video for our product. Use the uploaded logo
and screenshots. Make it 30 seconds with smooth transitions."

"Add a progress bar animation that fills up over 5 seconds."

"Change the background color to dark blue and add a particle effect."

"Make the text animation faster and add a bounce effect."
```

## Database Schema

```prisma
model Project {
  id              String    @id @default(uuid())
  name            String
  description     String?
  folderPath      String    @unique
  width           Int       @default(1920)
  height          Int       @default(1080)
  fps             Int       @default(30)
  durationInFrames Int      @default(300)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  assets          Asset[]
  sessions        Session[]
  exports         Export[]
}

model Asset {
  id           String   @id @default(uuid())
  projectId    String
  filename     String
  storedFilename String
  mimeType     String
  size         Int
  path         String
  thumbnail    String?
  metadata     Json?
  createdAt    DateTime @default(now())
}

model Export {
  id            String       @id @default(uuid())
  projectId     String
  compositionId String
  format        ExportFormat
  codec         String
  quality       Int
  outputPath    String?
  fileSize      Int?
  status        ExportStatus
  progress      Int          @default(0)
  errorMessage  String?
  createdAt     DateTime     @default(now())
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all projects |
| `/api/projects` | POST | Create a new project |
| `/api/projects/[id]` | GET | Get project details |
| `/api/projects/[id]` | PUT/PATCH | Update project |
| `/api/projects/[id]` | DELETE | Delete project |
| `/api/projects/[id]/assets` | GET | List project assets |
| `/api/projects/[id]/assets` | POST | Upload asset |
| `/api/projects/[id]/assets/[assetId]` | DELETE | Delete asset |
| `/api/projects/[id]/compositions` | GET | List compositions |
| `/api/projects/[id]/export` | GET | List exports |
| `/api/projects/[id]/export` | POST | Start export |
| `/api/projects/[id]/export/[exportId]/download` | GET | Download export |
| `/api/projects/[id]/studio/status` | GET | Get studio status |
| `/api/ws` | WebSocket | Terminal and studio communication |

## WebSocket Messages

### Client → Server

| Type | Description |
|------|-------------|
| `session:connect` | Connect to project session |
| `session:disconnect` | Disconnect from session |
| `terminal:input` | Send input to terminal |
| `terminal:resize` | Resize terminal |
| `studio:start` | Start Remotion Studio |
| `studio:stop` | Stop Remotion Studio |
| `studio:subscribe` | Subscribe to studio events |

### Server → Client

| Type | Description |
|------|-------------|
| `session:connected` | Session connected successfully |
| `session:error` | Session error |
| `terminal:output` | Terminal output data |
| `studio:started` | Studio started with port |
| `studio:stopped` | Studio stopped |
| `studio:error` | Studio error |
| `file:changed` | File change detected |

## Development

```bash
# Run development server
bun dev

# Run Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Build for production
bun run build

# Start production server
bun start
```

## Next Steps

- [ ] Multi-user authentication
- [ ] Git versioning for projects
- [ ] Real-time collaboration
- [ ] Project templates marketplace
- [ ] Cloud rendering (Remotion Lambda)
- [ ] Mobile UI

## License

[MIT](LICENSE)

## Credits

- [Remotion](https://remotion.dev) - Programmatic video framework
- [Claude Code](https://claude.ai/code) - AI coding assistant
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [xterm.js](https://xtermjs.org) - Terminal emulator
