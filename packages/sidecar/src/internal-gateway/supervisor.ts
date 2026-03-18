import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
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

const HOST_READY_TIMEOUT_MS = 20_000;

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

function createReadyUrl(port: number): string {
  return `http://127.0.0.1:${String(port)}/ready`;
}

async function waitForReady(port: number): Promise<void> {
  const readyUrl = createReadyUrl(port);
  const deadline = Date.now() + HOST_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(readyUrl, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the timeout expires.
    }

    await delay(150);
  }

  throw new Error("Timed out waiting for the embedded gateway to become ready.");
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

export class EmbeddedGatewaySupervisor {
  readonly #env: NodeJS.ProcessEnv;
  readonly #paths: EmbeddedGatewayPaths;
  #processState: EmbeddedGatewayProcessState | null = null;
  #stopping = false;

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
        OPENCLAW_SKIP_CHANNELS: "1",
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

    await Promise.race([waitForReady(port), exitPromise]);
    this.#processState = {
      child,
      port,
      token,
    };
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
