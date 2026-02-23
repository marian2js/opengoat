import { parseCommandJson } from "./runtime-logs.js";
import type { OpenClawUiService } from "./types.js";

interface OpenClawCommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface OpenClawCommandCapableService extends OpenClawUiService {
  runOpenClaw?: (
    args: string[],
    options?: { cwd?: string; env?: NodeJS.ProcessEnv },
  ) => Promise<OpenClawCommandResult>;
}

export interface OpenClawOnboardingGatewayStatus {
  command: string;
  installCommand: string;
  startCommand: string;
  installed: boolean;
  gatewayRunning: boolean;
  version: string | null;
  diagnostics: string | null;
  checkedAt: string;
}

const OPENCLAW_INSTALL_COMMAND = "npm i -g openclaw@latest";

export async function resolveOpenClawOnboardingGatewayStatus(
  service: OpenClawUiService,
): Promise<OpenClawOnboardingGatewayStatus> {
  const command = await resolveOpenClawCommand(service);
  const startCommand = `${command} gateway --allow-unconfigured`;
  const checkedAt = new Date().toISOString();
  if (!hasRunOpenClaw(service)) {
    return {
      command,
      installCommand: OPENCLAW_INSTALL_COMMAND,
      startCommand,
      installed: false,
      gatewayRunning: false,
      version: null,
      diagnostics:
        "OpenClaw command checks are unavailable in this runtime. Restart OpenGoat with the latest dependencies.",
      checkedAt,
    };
  }

  try {
    const versionResult = await runOpenClawCommand(service, ["--version"]);
    if (versionResult.code !== 0) {
      return {
        command,
        installCommand: OPENCLAW_INSTALL_COMMAND,
        startCommand,
        installed: false,
        gatewayRunning: false,
        version: null,
        diagnostics:
          versionResult.stderr.trim() ||
          versionResult.stdout.trim() ||
          `OpenClaw version check failed (exit ${versionResult.code}).`,
        checkedAt,
      };
    }

    const version = resolveOpenClawVersion(versionResult);
    try {
      const gatewayResult = await runOpenClawCommand(service, [
        "gateway",
        "status",
        "--json",
        "--no-probe",
      ]);
      if (gatewayResult.code !== 0) {
        return {
          command,
          installCommand: OPENCLAW_INSTALL_COMMAND,
          startCommand,
          installed: true,
          gatewayRunning: false,
          version,
          diagnostics:
            gatewayResult.stderr.trim() ||
            gatewayResult.stdout.trim() ||
            `OpenClaw gateway status check failed (exit ${gatewayResult.code}).`,
          checkedAt,
        };
      }

      const gatewayRunning = isGatewayStatusRunning(gatewayResult.stdout);
      return {
        command,
        installCommand: OPENCLAW_INSTALL_COMMAND,
        startCommand,
        installed: true,
        gatewayRunning,
        version,
        diagnostics: gatewayRunning
          ? null
          : "OpenClaw is installed, but the local gateway is not running.",
        checkedAt,
      };
    } catch (error) {
      return {
        command,
        installCommand: OPENCLAW_INSTALL_COMMAND,
        startCommand,
        installed: true,
        gatewayRunning: false,
        version,
        diagnostics: toCommandErrorMessage(
          error,
          "Unable to inspect OpenClaw gateway status.",
        ),
        checkedAt,
      };
    }
  } catch (error) {
    if (isCommandMissingError(error)) {
      return {
        command,
        installCommand: OPENCLAW_INSTALL_COMMAND,
        startCommand,
        installed: false,
        gatewayRunning: false,
        version: null,
        diagnostics:
          "OpenClaw CLI was not found on this machine. Install OpenClaw to continue.",
        checkedAt,
      };
    }

    return {
      command,
      installCommand: OPENCLAW_INSTALL_COMMAND,
      startCommand,
      installed: false,
      gatewayRunning: false,
      version: null,
      diagnostics: toCommandErrorMessage(
        error,
        "Unable to verify OpenClaw installation.",
      ),
      checkedAt,
    };
  }
}

function hasRunOpenClaw(
  service: OpenClawUiService,
): service is OpenClawCommandCapableService & {
  runOpenClaw: NonNullable<OpenClawCommandCapableService["runOpenClaw"]>;
} {
  return typeof (service as OpenClawCommandCapableService).runOpenClaw === "function";
}

async function runOpenClawCommand(
  service: OpenClawUiService,
  args: string[],
): Promise<OpenClawCommandResult> {
  const commandService = service as OpenClawCommandCapableService;
  const runner = commandService.runOpenClaw;
  if (typeof runner !== "function") {
    throw new Error("OpenClaw command checks are unavailable in this runtime.");
  }
  return runner.call(commandService, args);
}

async function resolveOpenClawCommand(service: OpenClawUiService): Promise<string> {
  if (typeof service.getOpenClawGatewayConfig === "function") {
    try {
      const config = await service.getOpenClawGatewayConfig();
      const configuredCommand = config.command?.trim();
      if (configuredCommand) {
        return configuredCommand;
      }
    } catch {
      // Ignore configuration lookup failures and fall back to env defaults.
    }
  }

  return (
    process.env.OPENGOAT_OPENCLAW_CMD?.trim() ||
    process.env.OPENCLAW_CMD?.trim() ||
    "openclaw"
  );
}

function resolveOpenClawVersion(result: OpenClawCommandResult): string | null {
  const raw = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const versionLine = raw[0];
  if (!versionLine) {
    return null;
  }
  const versionMatch = versionLine.match(/(\d+\.\d+\.\d+(?:[-+][^\s]+)?)/);
  return versionMatch?.[1] ?? versionLine;
}

function isGatewayStatusRunning(stdout: string): boolean {
  const parsed = parseCommandJson(stdout);
  const payload = resolvePayload(parsed);
  const port = asRecord(payload?.port);
  const portStatus = normalizeStatusToken(port?.status);
  if (portStatus === "listening") {
    return true;
  }
  if (portStatus === "busy" && isBusyPortOwnedByOpenClawGateway(port)) {
    return true;
  }

  const directRunning = payload?.running;
  if (directRunning === true) {
    return true;
  }

  const status = normalizeStatusToken(payload?.status);
  if (status === "running" || status === "ready" || status === "ok") {
    return true;
  }

  const normalizedStdout = stdout.toLowerCase();
  if (
    normalizedStdout.includes("gateway already running locally") ||
    normalizedStdout.includes("gateway already running")
  ) {
    return true;
  }

  return false;
}

function resolvePayload(
  parsed: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!parsed) {
    return null;
  }
  const result = asRecord(parsed.result);
  return result ?? parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeStatusToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function isBusyPortOwnedByOpenClawGateway(
  port: Record<string, unknown> | null,
): boolean {
  const listeners = Array.isArray(port?.listeners) ? port.listeners : [];
  for (const entry of listeners) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const listener = entry as Record<string, unknown>;
    const command = normalizeString(listener.command);
    const commandLine = normalizeString(listener.commandLine);
    if (
      commandLine.includes("openclaw-gateway") ||
      commandLine.includes("openclaw gateway") ||
      (command.includes("openclaw") && commandLine.includes("gateway"))
    ) {
      return true;
    }
  }

  const hints = Array.isArray(port?.hints) ? port.hints : [];
  for (const hint of hints) {
    const text = normalizeString(hint);
    if (
      text.includes("gateway already running locally") ||
      text.includes("gateway already running")
    ) {
      return true;
    }
  }

  return false;
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function isCommandMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "EACCES") {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") {
    return false;
  }
  return (
    message.includes("ENOENT") ||
    message.includes("EACCES") ||
    message.toLowerCase().includes("not found")
  );
}

function toCommandErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }
  return fallback;
}
