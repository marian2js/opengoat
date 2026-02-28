import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CliContext } from "../framework/command.js";

export const DEFAULT_UI_PORT = 19123;
export const DEFAULT_UI_HOST = "127.0.0.1";

const CLI_PACKAGE_NAME = "opengoat";
const FORCE_TOOL_REGISTRATION_ENV = "OPENGOAT_OPENCLAW_REGISTER_TOOLS";
const UI_STATE_DIR = ["runtime", "ui-server"] as const;
const SOFT_STOP_TIMEOUT_MS = 5_000;
const FORCE_STOP_TIMEOUT_MS = 2_000;
const PROCESS_EXIT_POLL_MS = 125;

export type ParsedUiServerArgs =
  | {
      ok: true;
      help: boolean;
      port?: number;
      host?: string;
    }
  | {
      ok: false;
      error: string;
    };

interface UiServerState {
  pid: number;
  host: string;
  port: number;
  command: string;
  startedAt: string;
}

export interface UiServerConfig {
  host: string;
  port: number;
  cliPackageRoot: string;
  resolvedEntry: string;
  resolvedEntryUsesTsx: boolean;
  env: NodeJS.ProcessEnv;
  stateFilePath: string;
}

export type UiServerConfigResolution =
  | { ok: true; config: UiServerConfig }
  | { ok: false; candidates: string[] };

interface UiEntrypointCandidate {
  path: string;
  usesTsx: boolean;
}

export interface UiServerStopResult {
  ok: boolean;
  stopped: boolean;
  note?: string;
  error?: string;
}

export function parseUiServerArgs(args: string[]): ParsedUiServerArgs {
  let help = false;
  let port: number | undefined;
  let host: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "help" || token === "--help" || token === "-h") {
      help = true;
      continue;
    }

    if (token === "--port") {
      const value = args[index + 1];
      if (!value) {
        return { ok: false, error: "Missing value for --port." };
      }
      const parsedPort = parseIntegerPort(value);
      if (!parsedPort) {
        return { ok: false, error: "Invalid --port. Expected an integer between 1 and 65535." };
      }
      port = parsedPort;
      index += 1;
      continue;
    }

    if (token.startsWith("--port=")) {
      const parsedPort = parseIntegerPort(token.slice("--port=".length));
      if (!parsedPort) {
        return { ok: false, error: "Invalid --port. Expected an integer between 1 and 65535." };
      }
      port = parsedPort;
      continue;
    }

    if (token === "--host") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --host." };
      }
      host = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--host=")) {
      const value = token.slice("--host=".length).trim();
      if (!value) {
        return { ok: false, error: "Missing value for --host." };
      }
      host = value;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    help,
    port,
    host,
  };
}

export function printUiServerHelp(
  output: NodeJS.WritableStream,
  commandName: "start" | "restart",
): void {
  output.write("Usage:\n");
  output.write(`  opengoat ${commandName} [--port <number>] [--host <host>]\n`);
  output.write("\n");
  if (commandName === "start") {
    output.write("Starts the OpenGoat UI server in production mode.\n");
  } else {
    output.write("Stops any tracked OpenGoat UI server for the target port, then starts it again.\n");
  }
  output.write(`Default host: ${DEFAULT_UI_HOST}\n`);
  output.write(`Default port: ${DEFAULT_UI_PORT}\n`);
}

export function printUiEntrypointNotFound(
  output: NodeJS.WritableStream,
  candidates: string[],
): void {
  output.write("OpenGoat UI build not found.\n");
  output.write("Expected one of:\n");
  for (const candidate of candidates) {
    output.write(`  - ${candidate}\n`);
  }
  output.write(
    'If you are running from source, build UI assets first: "pnpm --filter @opengoat/ui build".\n',
  );
}

export function resolveUiServerConfig(params: {
  port?: number;
  host?: string;
}): UiServerConfigResolution {
  const cliPackageRoot = resolveCliPackageRoot(
    path.dirname(fileURLToPath(import.meta.url)),
  );
  const resolvedEntry = resolveUiEntrypoint(cliPackageRoot);
  const candidates = listUiEntrypointCandidates(cliPackageRoot).map(
    (candidate) => candidate.path,
  );
  if (!resolvedEntry) {
    return {
      ok: false,
      candidates,
    };
  }

  const effectivePort =
    params.port ??
    parseIntegerPort(process.env.OPENGOAT_UI_PORT) ??
    parseIntegerPort(process.env.PORT) ??
    DEFAULT_UI_PORT;
  const effectiveHost =
    params.host?.trim() ||
    process.env.OPENGOAT_UI_HOST?.trim() ||
    DEFAULT_UI_HOST;
  const packageVersion = readCliPackageVersion(cliPackageRoot);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    OPENGOAT_UI_PORT: String(effectivePort),
    OPENGOAT_UI_HOST: effectiveHost,
    [FORCE_TOOL_REGISTRATION_ENV]: "1",
    ...(packageVersion ? { OPENGOAT_VERSION: packageVersion } : {}),
  };

  return {
    ok: true,
    config: {
      host: effectiveHost,
      port: effectivePort,
      cliPackageRoot,
      resolvedEntry: resolvedEntry.path,
      resolvedEntryUsesTsx: resolvedEntry.usesTsx,
      env,
      stateFilePath: resolveUiServerStatePath(effectivePort),
    },
  };
}

export async function runUiServerProcess(
  config: UiServerConfig,
  context: CliContext,
  commandName: "start" | "restart",
): Promise<number> {
  const childArgs = config.resolvedEntryUsesTsx
    ? ["--import", "tsx", config.resolvedEntry]
    : [config.resolvedEntry];
  const child = spawn(process.execPath, childArgs, {
    stdio: "inherit",
    env: config.env,
    cwd: config.cliPackageRoot,
  });

  const pid = child.pid;
  let childExited = false;
  const waitForExit = new Promise<number>((resolve) => {
    child.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      context.stderr.write(`Failed to start OpenGoat UI: ${message}\n`);
      resolve(1);
    });

    child.on("exit", (code, signal) => {
      childExited = true;
      void clearUiServerState(config, pid);
      if (signal) {
        context.stderr.write(`OpenGoat UI stopped by signal: ${signal}\n`);
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });

  if (typeof pid === "number" && pid > 0) {
    try {
      await writeUiServerState(config, {
        pid,
        host: config.host,
        port: config.port,
        command: commandName,
        startedAt: new Date().toISOString(),
      });
      if (childExited) {
        await clearUiServerState(config, pid);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.stderr.write(`Warning: failed to persist OpenGoat UI state: ${message}\n`);
    }
  } else {
    context.stderr.write("Warning: OpenGoat UI PID was unavailable; restart tracking is disabled.\n");
  }

  return waitForExit;
}

export async function stopTrackedUiServer(
  config: UiServerConfig,
): Promise<UiServerStopResult> {
  const state = await readUiServerState(config.stateFilePath);
  if (!state) {
    return {
      ok: true,
      stopped: false,
      note: `No running OpenGoat UI found for port ${config.port}.`,
    };
  }

  const pid = state.pid;
  if (!Number.isInteger(pid) || pid <= 0) {
    await clearUiServerState(config);
    return {
      ok: true,
      stopped: false,
      note: `Found stale OpenGoat UI state for port ${config.port}; starting a new server.`,
    };
  }

  if (pid === process.pid) {
    return {
      ok: false,
      stopped: false,
      error: "Refusing to stop the active CLI process.",
    };
  }

  if (!isProcessAlive(pid)) {
    await clearUiServerState(config, pid);
    return {
      ok: true,
      stopped: false,
      note: `Tracked OpenGoat UI process (${pid}) is not running; starting a new server.`,
    };
  }

  const terminateResult = sendSignal(pid, "SIGTERM");
  if (!terminateResult.ok) {
    return {
      ok: false,
      stopped: false,
      error: `Failed to stop existing OpenGoat UI process (${pid}): ${terminateResult.error}`,
    };
  }

  const stoppedAfterTerminate = await waitForProcessExit(pid, SOFT_STOP_TIMEOUT_MS);
  if (stoppedAfterTerminate) {
    await clearUiServerState(config, pid);
    return {
      ok: true,
      stopped: true,
      note: `Stopped OpenGoat UI process (${pid}).`,
    };
  }

  const forceResult = sendSignal(pid, "SIGKILL");
  if (!forceResult.ok) {
    return {
      ok: false,
      stopped: false,
      error: `OpenGoat UI process (${pid}) did not stop after SIGTERM and could not be force-stopped: ${forceResult.error}`,
    };
  }

  const stoppedAfterForce = await waitForProcessExit(pid, FORCE_STOP_TIMEOUT_MS);
  if (!stoppedAfterForce) {
    return {
      ok: false,
      stopped: false,
      error: `OpenGoat UI process (${pid}) did not stop after SIGTERM/SIGKILL.`,
    };
  }

  await clearUiServerState(config, pid);
  return {
    ok: true,
    stopped: true,
    note: `Stopped OpenGoat UI process (${pid}) with SIGKILL.`,
  };
}

export function resolveUiServerStatePath(port: number): string {
  const homeDir = resolveOpenGoatHomeDir();
  return path.join(homeDir, ...UI_STATE_DIR, `ui-${port}.json`);
}

function parseIntegerPort(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return undefined;
  }
  return value;
}

function resolveUiEntrypoint(
  cliPackageRoot: string,
): UiEntrypointCandidate | undefined {
  const explicit = process.env.OPENGOAT_UI_SERVER_ENTRY?.trim();
  if (explicit) {
    const explicitPath = path.resolve(explicit);
    if (!existsSync(explicitPath)) {
      return undefined;
    }
    return {
      path: explicitPath,
      usesTsx: explicitPath.endsWith(".ts"),
    };
  }

  const forceDist =
    process.env.OPENGOAT_UI_USE_DIST === "1" ||
    process.env.OPENGOAT_USE_DIST === "1";

  for (const candidate of listUiEntrypointCandidates(cliPackageRoot)) {
    if (forceDist && candidate.usesTsx) {
      continue;
    }
    if (existsSync(candidate.path)) {
      return candidate;
    }
  }
  return undefined;
}

function listUiEntrypointCandidates(
  cliPackageRoot: string,
): UiEntrypointCandidate[] {
  const srcCandidate = {
    path: path.join(cliPackageRoot, "..", "ui", "src", "server", "index.ts"),
    usesTsx: true,
  } satisfies UiEntrypointCandidate;
  const distWorkspaceCandidate = {
    path: path.join(cliPackageRoot, "..", "ui", "dist", "server", "index.js"),
    usesTsx: false,
  } satisfies UiEntrypointCandidate;
  const distBundledCandidate = {
    path: path.join(cliPackageRoot, "dist", "ui", "dist", "server", "index.js"),
    usesTsx: false,
  } satisfies UiEntrypointCandidate;

  return [
    srcCandidate,
    distWorkspaceCandidate,
    distBundledCandidate,
  ];
}

function resolveCliPackageRoot(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
          name?: string;
        };
        if (parsed.name === CLI_PACKAGE_NAME) {
          return currentDir;
        }
      } catch {
        // Ignore malformed package.json files and continue walking up.
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Unable to resolve opengoat package root.");
    }
    currentDir = parentDir;
  }
}

function readCliPackageVersion(cliPackageRoot: string): string | undefined {
  const packageJsonPath = path.join(cliPackageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version?: string;
    };
    const version = parsed.version?.trim();
    return version || undefined;
  } catch {
    return undefined;
  }
}

function resolveOpenGoatHomeDir(): string {
  const override = process.env.OPENGOAT_HOME?.trim();
  if (override) {
    return path.resolve(expandTilde(override));
  }
  return path.join(os.homedir(), ".opengoat");
}

function expandTilde(value: string): string {
  if (!value.startsWith("~")) {
    return value;
  }

  if (value === "~") {
    return os.homedir();
  }

  return path.join(os.homedir(), value.slice(2));
}

async function writeUiServerState(
  config: UiServerConfig,
  state: UiServerState,
): Promise<void> {
  const stateDir = path.dirname(config.stateFilePath);
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    config.stateFilePath,
    `${JSON.stringify(state, null, 2)}\n`,
    "utf-8",
  );
}

async function clearUiServerState(
  config: UiServerConfig,
  expectedPid?: number,
): Promise<void> {
  if (expectedPid !== undefined) {
    const state = await readUiServerState(config.stateFilePath);
    if (state && state.pid !== expectedPid) {
      return;
    }
  }
  await rm(config.stateFilePath, { force: true });
}

async function readUiServerState(stateFilePath: string): Promise<UiServerState | null> {
  try {
    const raw = await readFile(stateFilePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UiServerState>;
    const pid = parsed.pid;
    const port = parsed.port;
    const host = parsed.host;
    const command = parsed.command;
    const startedAt = parsed.startedAt;
    if (
      !parsed ||
      typeof pid !== "number" ||
      !Number.isInteger(pid) ||
      typeof port !== "number" ||
      typeof host !== "string" ||
      typeof command !== "string" ||
      typeof startedAt !== "string"
    ) {
      return null;
    }
    return {
      pid,
      host,
      port,
      command,
      startedAt,
    };
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "ESRCH") {
      return false;
    }
    if (code === "EPERM") {
      return true;
    }
    return false;
  }
}

function sendSignal(pid: number, signal: NodeJS.Signals): { ok: boolean; error?: string } {
  try {
    process.kill(pid, signal);
    return { ok: true };
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "ESRCH") {
      return { ok: true };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await delay(PROCESS_EXIT_POLL_MS);
  }
  return !isProcessAlive(pid);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}
