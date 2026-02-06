import {
  DEFAULT_BOOTSTRAP_MAX_CHARS,
  DEFAULT_WORKSPACE_BOOTSTRAP_FILES,
  type WorkspaceBootstrapFile,
  type WorkspaceContextFile
} from "../domain/workspace-context.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";

const BOOTSTRAP_HEAD_RATIO = 0.7;
const BOOTSTRAP_TAIL_RATIO = 0.2;

interface WorkspaceContextServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
}

export interface BuildContextFilesOptions {
  maxChars?: number;
  warn?: (message: string) => void;
}

export class WorkspaceContextService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;

  public constructor(deps: WorkspaceContextServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
  }

  public getDefaultBootstrapFileNames(): string[] {
    return [...DEFAULT_WORKSPACE_BOOTSTRAP_FILES];
  }

  public resolveBootstrapFileNames(fileNames?: string[]): string[] {
    if (!fileNames || fileNames.length === 0) {
      return this.getDefaultBootstrapFileNames();
    }

    const deduped = new Set<string>();
    for (const name of fileNames) {
      const trimmed = name.trim();
      if (!trimmed) {
        continue;
      }
      deduped.add(trimmed);
    }

    if (deduped.size === 0) {
      return this.getDefaultBootstrapFileNames();
    }

    return [...deduped];
  }

  public async loadWorkspaceBootstrapFiles(
    workspaceDir: string,
    fileNames?: string[]
  ): Promise<WorkspaceBootstrapFile[]> {
    const files = this.resolveBootstrapFileNames(fileNames);
    const result: WorkspaceBootstrapFile[] = [];

    for (const name of files) {
      const filePath = this.pathPort.join(workspaceDir, name);
      try {
        const content = await this.fileSystem.readFile(filePath);
        result.push({
          name,
          path: filePath,
          content,
          missing: false
        });
      } catch {
        result.push({
          name,
          path: filePath,
          missing: true
        });
      }
    }

    return result;
  }

  public buildContextFiles(files: WorkspaceBootstrapFile[], options: BuildContextFilesOptions = {}): WorkspaceContextFile[] {
    const maxChars = resolveBootstrapMaxChars(options.maxChars);
    const result: WorkspaceContextFile[] = [];

    for (const file of files) {
      if (file.missing) {
        result.push({
          path: file.name,
          content: `[MISSING] Expected at: ${file.path}`
        });
        continue;
      }

      const trimmed = trimBootstrapContent(file.content ?? "", file.name, maxChars);
      if (!trimmed.content) {
        continue;
      }

      if (trimmed.truncated) {
        options.warn?.(
          `workspace bootstrap file ${file.name} is ${trimmed.originalLength} chars (limit ${trimmed.maxChars}); truncating in injected context`
        );
      }

      result.push({
        path: file.name,
        content: trimmed.content
      });
    }

    return result;
  }

  public buildSystemPrompt(params: {
    agentId: string;
    displayName: string;
    workspaceDir: string;
    nowIso: string;
    contextFiles: WorkspaceContextFile[];
  }): string {
    const lines: string[] = [
      "# OpenGoat System Prompt",
      `You are ${params.displayName} (${params.agentId}), an autonomous agent managed by OpenGoat.`,
      "",
      "## Workspace",
      `Path: ${params.workspaceDir}`,
      "The workspace is your default working directory.",
      "Use Markdown and JSON files for durable context and operational state.",
      "",
      "## Workspace Files (injected)",
      "These workspace files are loaded by OpenGoat and included below in Project Context.",
      ""
    ];

    if (params.contextFiles.length > 0) {
      const hasSoulFile = params.contextFiles.some((file) => {
        return normalizePathBasename(file.path).toLowerCase() === "soul.md";
      });

      lines.push("# Project Context", "", "The following project context files have been loaded:");
      if (hasSoulFile) {
        lines.push(
          "If SOUL.md is present, embody its persona and tone unless higher-priority instructions override it."
        );
      }
      lines.push("");

      for (const file of params.contextFiles) {
        lines.push(`## ${file.path}`, "", file.content, "");
      }
    }

    lines.push("## Current Date & Time", params.nowIso);
    return lines.filter(Boolean).join("\n");
  }
}

function resolveBootstrapMaxChars(maxChars?: number): number {
  if (typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0) {
    return Math.floor(maxChars);
  }
  return DEFAULT_BOOTSTRAP_MAX_CHARS;
}

function trimBootstrapContent(
  content: string,
  fileName: string,
  maxChars: number
): {
  content: string;
  truncated: boolean;
  maxChars: number;
  originalLength: number;
} {
  const trimmed = content.trimEnd();
  if (trimmed.length === 0) {
    return {
      content: "",
      truncated: false,
      maxChars,
      originalLength: 0
    };
  }

  if (trimmed.length <= maxChars) {
    return {
      content: trimmed,
      truncated: false,
      maxChars,
      originalLength: trimmed.length
    };
  }

  const headChars = Math.floor(maxChars * BOOTSTRAP_HEAD_RATIO);
  const tailChars = Math.floor(maxChars * BOOTSTRAP_TAIL_RATIO);
  const head = trimmed.slice(0, headChars);
  const tail = trimmed.slice(-tailChars);
  const marker = [
    "",
    `[...truncated, read ${fileName} for full content...]`,
    `...(truncated ${fileName}: kept ${headChars}+${tailChars} chars of ${trimmed.length})...`,
    ""
  ].join("\n");

  return {
    content: [head, marker, tail].join("\n"),
    truncated: true,
    maxChars,
    originalLength: trimmed.length
  };
}

function normalizePathBasename(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

