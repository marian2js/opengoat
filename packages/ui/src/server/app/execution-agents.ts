import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { UiProviderOption } from "./types.js";

const execFileAsync = promisify(execFile);
const DEFAULT_CHECK_ARGS = ["--version"];
const COMMAND_CHECK_TIMEOUT_MS = 3_500;

export interface UiExecutionAgentOption {
  id: string;
  displayName: string;
  commandCandidates: string[];
  installHint: string;
}

export interface UiExecutionAgentReadiness extends UiExecutionAgentOption {
  installed: boolean;
  checkedCommand: string | null;
  diagnostics: string | null;
  checkedAt: string;
}

interface ExecutionAgentMetadata {
  commandCandidates: string[];
  installHint: string;
}

const EXECUTION_AGENT_METADATA_BY_PROVIDER_ID: Record<
  string,
  ExecutionAgentMetadata
> = {
  "claude-code": {
    commandCandidates: ["claude", "claude-code"],
    installHint:
      "Install Claude Code CLI and ensure `claude` is available on your PATH.",
  },
  codex: {
    commandCandidates: ["codex"],
    installHint:
      "Install Codex CLI and ensure `codex` is available on your PATH.",
  },
  cursor: {
    commandCandidates: ["cursor-agent", "cursor"],
    installHint:
      "Install Cursor CLI and ensure `cursor-agent` (or `cursor`) is available on your PATH.",
  },
  opencode: {
    commandCandidates: ["opencode"],
    installHint:
      "Install OpenCode CLI and ensure `opencode` is available on your PATH.",
  },
  "copilot-cli": {
    commandCandidates: ["copilot"],
    installHint:
      "Install GitHub Copilot CLI and ensure `copilot` is available on your PATH.",
  },
  "gemini-cli": {
    commandCandidates: ["gemini"],
    installHint:
      "Install Gemini CLI and ensure `gemini` is available on your PATH.",
  },
};

export function resolveExecutionAgentOptions(
  providers: UiProviderOption[],
): UiExecutionAgentOption[] {
  const options: UiExecutionAgentOption[] = [];
  const seenProviderIds = new Set<string>();

  for (const provider of providers) {
    if (provider.id === "openclaw") {
      continue;
    }

    if (seenProviderIds.has(provider.id)) {
      continue;
    }
    seenProviderIds.add(provider.id);
    const metadata = resolveExecutionAgentMetadata(provider.id, provider.displayName);
    options.push({
      id: provider.id,
      displayName: provider.displayName,
      commandCandidates: metadata.commandCandidates,
      installHint: metadata.installHint,
    });
  }

  return options;
}

export async function resolveExecutionAgentReadiness(
  option: UiExecutionAgentOption,
): Promise<UiExecutionAgentReadiness> {
  let diagnostics: string | null = null;

  for (const command of option.commandCandidates) {
    const probe = await probeCliCommand(command);
    if (probe.status === "missing") {
      diagnostics = probe.diagnostics ?? diagnostics;
      continue;
    }

    if (probe.status === "available") {
      return {
        ...option,
        installed: true,
        checkedCommand: command,
        diagnostics: probe.diagnostics,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  return {
    ...option,
    installed: false,
    checkedCommand: null,
    diagnostics:
      diagnostics ??
      `None of the expected commands were found (${option.commandCandidates.join(", ")}).`,
    checkedAt: new Date().toISOString(),
  };
}

function resolveExecutionAgentMetadata(
  providerId: string,
  displayName: string,
): ExecutionAgentMetadata {
  const known = EXECUTION_AGENT_METADATA_BY_PROVIDER_ID[providerId];
  if (known) {
    return {
      commandCandidates: [...known.commandCandidates],
      installHint: known.installHint,
    };
  }

  const inferredCommandCandidates = inferCommandCandidates(providerId);
  return {
    commandCandidates: inferredCommandCandidates,
    installHint: `Install ${displayName} CLI and ensure one of these commands is available on your PATH: ${inferredCommandCandidates.join(", ")}.`,
  };
}

function inferCommandCandidates(providerId: string): string[] {
  const normalized = providerId.trim().toLowerCase();
  if (!normalized) {
    return ["provider-cli"];
  }

  const candidates: string[] = [];
  candidates.push(normalized);

  const strippedCliSuffix = normalized.replace(/-?cli$/u, "");
  if (strippedCliSuffix && strippedCliSuffix !== normalized) {
    candidates.push(strippedCliSuffix);
  }

  const firstSegment = strippedCliSuffix.split(/[-_]/u).filter(Boolean)[0];
  if (firstSegment && !candidates.includes(firstSegment)) {
    candidates.push(firstSegment);
  }

  return candidates;
}

async function probeCliCommand(
  command: string,
): Promise<{ status: "available"; diagnostics: string | null } | { status: "missing"; diagnostics: string | null }> {
  try {
    await execFileAsync(command, DEFAULT_CHECK_ARGS, {
      timeout: COMMAND_CHECK_TIMEOUT_MS,
    });
    return {
      status: "available",
      diagnostics: null,
    };
  } catch (error) {
    if (isMissingCommandError(error)) {
      return {
        status: "missing",
        diagnostics: null,
      };
    }

    if (isCommandExecutionFailure(error)) {
      return {
        status: "available",
        diagnostics: normalizeErrorMessage(error),
      };
    }

    return {
      status: "missing",
      diagnostics: normalizeErrorMessage(error),
    };
  }
}

function isMissingCommandError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") {
    return true;
  }

  const message = normalizeErrorMessage(error);
  return message.toLowerCase().includes("not found");
}

function isCommandExecutionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  if (typeof code === "number") {
    return true;
  }
  if (code === null) {
    return true;
  }

  const signal = (error as { signal?: unknown }).signal;
  return typeof signal === "string" && signal.length > 0;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim();
  }
  return "";
}
