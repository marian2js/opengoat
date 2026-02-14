import { spawn, type SpawnOptions } from "node:child_process";
import type { FastifyInstance } from "fastify";

const MAX_PORT = 65535;

export interface ListenWithPortFallbackOptions {
  host: string;
  port: number;
}

export interface ListenWithPortFallbackResult {
  requestedPort: number;
  resolvedPort: number;
}

export async function listenWithPortFallback(
  server: FastifyInstance,
  options: ListenWithPortFallbackOptions,
): Promise<ListenWithPortFallbackResult> {
  const requestedPort = options.port;
  let currentPort = requestedPort;

  while (currentPort <= MAX_PORT) {
    try {
      await server.listen({
        host: options.host,
        port: currentPort,
      });
      return {
        requestedPort,
        resolvedPort: currentPort,
      };
    } catch (error) {
      if (!isAddressInUseError(error)) {
        throw error;
      }

      server.log.warn(
        {
          host: options.host,
          requestedPort,
          attemptedPort: currentPort,
          nextPort: currentPort + 1,
        },
        "OpenGoat UI port already in use; retrying with next port.",
      );
      currentPort += 1;
    }
  }

  throw new Error(
    `OpenGoat UI failed to find a free port from ${requestedPort} to ${MAX_PORT}.`,
  );
}

interface BrowserOpenCommand {
  command: string;
  args: string[];
}

type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => {
  on(event: "error", listener: (error: Error) => void): unknown;
  unref(): void;
};

export function openUrlInBrowser(url: string): void {
  openUrlInBrowserWithDeps(url, {
    platform: process.platform,
    spawnProcess: (command, args, options) => spawn(command, args, options),
  });
}

export function openUrlInBrowserWithDeps(
  url: string,
  deps: {
    platform: NodeJS.Platform;
    spawnProcess: SpawnProcess;
  },
): void {
  const openCommand = resolveBrowserOpenCommand(deps.platform, url);
  if (!openCommand) {
    return;
  }

  try {
    const processHandle = deps.spawnProcess(openCommand.command, openCommand.args, {
      detached: true,
      stdio: "ignore",
    });

    processHandle.on("error", () => {
      // Best-effort launch: ignore browser-open failures.
    });
    processHandle.unref();
  } catch {
    // Best-effort launch: ignore browser-open failures.
  }
}

export function resolveBrowserOpenCommand(
  platform: NodeJS.Platform,
  url: string,
): BrowserOpenCommand | undefined {
  if (platform === "darwin") {
    return {
      command: "open",
      args: [url],
    };
  }

  if (platform === "win32") {
    return {
      command: "cmd",
      args: ["/c", "start", "", url],
    };
  }

  if (platform === "linux") {
    return {
      command: "xdg-open",
      args: [url],
    };
  }

  return undefined;
}

function isAddressInUseError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode === "EADDRINUSE") {
    return true;
  }

  const maybeMessage = (error as { message?: unknown }).message;
  return (
    typeof maybeMessage === "string" &&
    maybeMessage.includes("EADDRINUSE")
  );
}
