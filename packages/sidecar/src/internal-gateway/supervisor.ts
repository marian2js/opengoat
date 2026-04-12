import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { sidecarLogger } from "../logger.ts";
import { writeEmbeddedGatewayConfig } from "./config.ts";
import { resolveGatewayCliEntrypoint } from "./package-paths.ts";
import {
  ensureEmbeddedGatewayDirectories,
  resolveEmbeddedGatewayPaths,
  type EmbeddedGatewayPaths,
} from "./paths.ts";
import { pickGatewayPort } from "./port.ts";
import { loadOrCreateGatewayToken } from "./token-store.ts";

interface EmbeddedGatewayProcessState {
  child: ChildProcess;
  port: number;
  token: string;
}

const DEFAULT_HOST_READY_TIMEOUT_MS = 60_000;

function resolveHostCommand(port: number, token: string): {
  args: string[];
  command: string;
} {
  return {
    args: [
      resolveGatewayCliEntrypoint(),
      "gateway",
      "run",
      "--allow-unconfigured",
      "--auth",
      "token",
      "--bind",
      "loopback",
      "--token",
      token,
      "--port",
      String(port),
    ],
    command: process.execPath,
  };
}

function createHealthUrl(port: number): string {
  return `http://127.0.0.1:${String(port)}/health`;
}

function resolveHostReadyTimeoutMs(env: NodeJS.ProcessEnv): number {
  const candidate = env.OPENGOAT_GATEWAY_READY_TIMEOUT_MS?.trim();
  if (!candidate) {
    return DEFAULT_HOST_READY_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(candidate, 10);
  return Number.isInteger(parsed) && parsed >= 1_000
    ? parsed
    : DEFAULT_HOST_READY_TIMEOUT_MS;
}

async function waitForReady(
  port: number,
  timeoutMs: number,
): Promise<void> {
  const healthUrl = createHealthUrl(port);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the timeout expires.
    }

    await delay(150);
  }

  throw new Error(
    `Timed out waiting for the embedded gateway to become ready after ${String(timeoutMs)}ms.`,
  );
}

function pipeLogs(child: ChildProcess, prefix: string): void {
  child.stdout?.on("data", (chunk) => {
    process.stderr.write(`[gateway:${prefix}] ${String(chunk)}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[gateway:${prefix}] ${String(chunk)}`);
  });
}

function shouldPipeGatewayLogs(env: NodeJS.ProcessEnv): boolean {
  return env.OPENGOAT_VERBOSE_GATEWAY?.trim() === "1";
}

const MAX_RESTART_ATTEMPTS = 5;
const RESTART_COOLDOWN_MS = 2_000;

export class EmbeddedGatewaySupervisor {
  readonly #env: NodeJS.ProcessEnv;
  readonly #paths: EmbeddedGatewayPaths;
  #processState: EmbeddedGatewayProcessState | null = null;
  #stopping = false;
  #restartAttempts = 0;
  #lastRestartAt = 0;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.#env = env;
    this.#paths = resolveEmbeddedGatewayPaths(env);
  }

  get paths(): EmbeddedGatewayPaths {
    return this.#paths;
  }

  get connection(): { token: string; url: string } {
    const current = this.#processState;
    if (!current) {
      throw new Error("Embedded gateway has not been started.");
    }

    return {
      token: current.token,
      url: `http://127.0.0.1:${String(current.port)}`,
    };
  }

  async start(): Promise<void> {
    if (this.#processState) {
      return;
    }

    await ensureEmbeddedGatewayDirectories(this.#paths);
    const token = await loadOrCreateGatewayToken(this.#paths.tokenPath);
    const port = await pickGatewayPort();
    const hostReadyTimeoutMs = resolveHostReadyTimeoutMs(this.#env);
    await writeEmbeddedGatewayConfig({
      paths: this.#paths,
      port,
      token,
    });

    const command = resolveHostCommand(port, token);
    const child = spawn(command.command, command.args, {
      env: {
        ...this.#env,
        OPENGOAT_GATEWAY_PORT: String(port),
        OPENGOAT_GATEWAY_TOKEN: token,
        OPENCLAW_CONFIG_PATH: this.#paths.configPath,
        OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
        OPENCLAW_OAUTH_DIR: this.#paths.oauthDir,
        OPENCLAW_STATE_DIR: this.#paths.stateDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (shouldPipeGatewayLogs(this.#env)) {
      pipeLogs(child, "embedded");
    }

    const exitPromise = new Promise<never>((_, reject) => {
      child.once("exit", (code, signal) => {
        if (!this.#stopping) {
          reject(
            new Error(
              `Embedded gateway exited before readiness (code=${String(code)} signal=${String(signal)})`,
            ),
          );
        }
      });
    });

    await Promise.race([waitForReady(port, hostReadyTimeoutMs), exitPromise]);

    // Replace the startup-only exit handler with a persistent auto-restart handler.
    child.removeAllListeners("exit");
    child.on("exit", (code, signal) => {
      if (this.#stopping) {
        return;
      }
      sidecarLogger.warn(
        `gateway exited unexpectedly (code=${String(code)} signal=${String(signal)}); scheduling restart`,
      );
      this.#processState = null;
      void this.#scheduleRestart();
    });

    this.#processState = {
      child,
      port,
      token,
    };
    this.#restartAttempts = 0;
  }

  async #scheduleRestart(): Promise<void> {
    const now = Date.now();
    if (now - this.#lastRestartAt > 60_000) {
      this.#restartAttempts = 0;
    }

    this.#restartAttempts++;
    if (this.#restartAttempts > MAX_RESTART_ATTEMPTS) {
      sidecarLogger.error(
        `gateway exceeded ${String(MAX_RESTART_ATTEMPTS)} restart attempts; giving up`,
      );
      return;
    }

    const backoff = RESTART_COOLDOWN_MS * this.#restartAttempts;
    sidecarLogger.info(
      `restarting gateway in ${String(backoff)}ms (attempt ${String(this.#restartAttempts)}/${String(MAX_RESTART_ATTEMPTS)})`,
    );
    await delay(backoff);

    if (this.#stopping || this.#processState) {
      return;
    }

    try {
      this.#lastRestartAt = Date.now();
      await this.start();
      sidecarLogger.info("gateway restarted successfully");
    } catch (error) {
      sidecarLogger.error("gateway restart failed", error);
      void this.#scheduleRestart();
    }
  }

  async stop(): Promise<void> {
    const current = this.#processState;
    if (!current) {
      return;
    }

    this.#stopping = true;
    current.child.kill("SIGTERM");
    await Promise.race([
      new Promise<void>((resolve) => {
        current.child.once("exit", () => {
          resolve();
        });
      }),
      delay(3_000).then(() => {
        if (!current.child.killed) {
          current.child.kill("SIGKILL");
        }
      }),
    ]);
    this.#stopping = false;
    this.#processState = null;
  }
}
