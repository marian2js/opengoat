export const DEFAULT_BOOTSTRAP_MAX_CHARS = 20_000;

export const DEFAULT_WORKSPACE_BOOTSTRAP_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "CONTEXT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
  "memory.md"
] as const;

export type WorkspaceBootstrapFileName = (typeof DEFAULT_WORKSPACE_BOOTSTRAP_FILES)[number];

export interface WorkspaceBootstrapFile {
  name: string;
  path: string;
  content?: string;
  missing: boolean;
}

export interface WorkspaceContextFile {
  path: string;
  content: string;
}

