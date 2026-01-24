import { join, resolve, normalize } from "path";

// Get the projects root directory
function getProjectsRoot(): string {
  return process.env.PROJECTS_ROOT || join(process.cwd(), "projects");
}

// Validate that a path is within the allowed project directory
export function validateProjectPath(
  projectId: string,
  requestedPath: string
): boolean {
  const projectsRoot = getProjectsRoot();
  const allowedBase = resolve(projectsRoot, projectId);
  const normalizedPath = resolve(normalize(requestedPath));

  // Check if the normalized path starts with the allowed base
  return normalizedPath.startsWith(allowedBase);
}

// Get the safe working directory for a project
export function getSafeWorkingDirectory(projectId: string): string {
  const projectsRoot = getProjectsRoot();
  const remotionPath = join(projectsRoot, projectId, "remotion");
  return resolve(remotionPath);
}

// Dangerous command patterns to block
const DANGEROUS_PATTERNS = [
  // Destructive commands
  /rm\s+(-[rf]+\s+)*\//i, // rm -rf / or similar
  /rm\s+(-[rf]+\s+)*~/i, // rm in home directory
  /rm\s+(-[rf]+\s+)*\.\./i, // rm with parent directory traversal
  /mkfs\./i, // Format filesystem
  /dd\s+.*of=\/dev/i, // Write to devices

  // Fork bombs
  /:\(\)\s*{\s*:\|:&\s*}\s*;/i,
  /fork\s+while/i,

  // Privilege escalation
  /chmod\s+.*777\s+\//i, // chmod 777 on root
  /chown\s+.*\//i, // chown on root

  // Network attacks
  /nc\s+.*-e/i, // Netcat with execute
  /curl\s+.*\|\s*bash/i, // Curl pipe to bash
  /wget\s+.*\|\s*bash/i, // Wget pipe to bash

  // System modifications
  /crontab\s+-r/i, // Remove all crontabs
  /shutdown/i,
  /reboot/i,
  /init\s+0/i,
  /poweroff/i,

  // Directory traversal attempts
  /cd\s+\.\.\/.*/i, // Excessive parent directory navigation
];

// Check if a command contains dangerous patterns
export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

// Sanitize environment variables for PTY sessions
export function getSafeEnvironment(projectId: string): Record<string, string> {
  const projectsRoot = getProjectsRoot();
  const remotionPath = join(projectsRoot, projectId, "remotion");

  // Start with a copy of the current environment to ensure shell can spawn
  const safeEnv: Record<string, string> = {};

  // Copy essential environment variables from parent process
  const essentialVars = [
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "TERM",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TMPDIR",
    "XDG_RUNTIME_DIR",
    "SSH_AUTH_SOCK",
    // macOS specific
    "LOGNAME",
    "__CF_USER_TEXT_ENCODING",
    "Apple_PubSub_Socket_Render",
    // Node.js
    "NODE_PATH",
    "NVM_DIR",
    "NVM_BIN",
    "NVM_INC",
    // npm/yarn/bun
    "npm_config_prefix",
    "BUN_INSTALL",
  ];

  for (const key of essentialVars) {
    if (process.env[key]) {
      safeEnv[key] = process.env[key]!;
    }
  }

  // Override/add specific values
  return {
    ...safeEnv,
    // Ensure terminal type is set
    TERM: "xterm-256color",
    // Ensure UTF-8 encoding for accented characters
    LANG: safeEnv.LANG || "en_US.UTF-8",
    LC_ALL: safeEnv.LC_ALL || "en_US.UTF-8",
    LC_CTYPE: safeEnv.LC_CTYPE || "en_US.UTF-8",
    // Project-specific
    PROJECT_ID: projectId,
    REMOTION_PROJECT: remotionPath,
    // Node.js
    NODE_ENV: "development",
    // Restrict Claude Code to project directory
    CLAUDE_CODE_ALLOWED_PATHS: remotionPath,
  };
}

// Maximum output buffer size (5000 characters)
export const MAX_OUTPUT_BUFFER_SIZE = 5000;

// Truncate output buffer if it exceeds max size
export function truncateOutputBuffer(buffer: string): string {
  if (buffer.length > MAX_OUTPUT_BUFFER_SIZE) {
    return buffer.slice(-MAX_OUTPUT_BUFFER_SIZE);
  }
  return buffer;
}
