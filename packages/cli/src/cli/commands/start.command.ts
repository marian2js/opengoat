import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CliCommand } from "../framework/command.js";

const DEFAULT_UI_PORT = 19123;
const DEFAULT_UI_HOST = "127.0.0.1";
const CLI_PACKAGE_NAME = "opengoat";

export const startCommand: CliCommand = {
  path: ["start"],
  description: "Run OpenGoat UI (production server).",
  async run(args, context): Promise<number> {
    const parsed = parseStartArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    const cliPackageRoot = resolveCliPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
    const resolvedEntry = resolveUiEntrypoint(cliPackageRoot);
    if (!resolvedEntry) {
      context.stderr.write("OpenGoat UI build not found.\n");
      context.stderr.write("Expected one of:\n");
      for (const candidate of listUiEntrypointCandidates(cliPackageRoot)) {
        context.stderr.write(`  - ${candidate}\n`);
      }
      context.stderr.write(
        'If you are running from source, build UI assets first: "pnpm --filter @opengoat/ui build".\n',
      );
      return 1;
    }

    const effectivePort =
      parsed.port ??
      parseIntegerPort(process.env.OPENGOAT_UI_PORT) ??
      parseIntegerPort(process.env.PORT) ??
      DEFAULT_UI_PORT;
    const effectiveHost =
      parsed.host?.trim() ||
      process.env.OPENGOAT_UI_HOST?.trim() ||
      DEFAULT_UI_HOST;
    const packageVersion = readCliPackageVersion(cliPackageRoot);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      OPENGOAT_UI_PORT: String(effectivePort),
      OPENGOAT_UI_HOST: effectiveHost,
      ...(packageVersion ? { OPENGOAT_VERSION: packageVersion } : {}),
    };

    context.stdout.write(
      `Starting OpenGoat UI at http://${effectiveHost}:${effectivePort}\n`,
    );

    return new Promise<number>((resolve) => {
      const child = spawn(process.execPath, [resolvedEntry], {
        stdio: "inherit",
        env,
        cwd: cliPackageRoot,
      });

      child.on("error", (error) => {
        const message = error instanceof Error ? error.message : String(error);
        context.stderr.write(`Failed to start OpenGoat UI: ${message}\n`);
        resolve(1);
      });

      child.on("exit", (code, signal) => {
        if (signal) {
          context.stderr.write(`OpenGoat UI stopped by signal: ${signal}\n`);
          resolve(1);
          return;
        }
        resolve(code ?? 1);
      });
    });
  },
};

type ParsedStartArgs =
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

function parseStartArgs(args: string[]): ParsedStartArgs {
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

function resolveUiEntrypoint(cliPackageRoot: string): string | undefined {
  const explicit = process.env.OPENGOAT_UI_SERVER_ENTRY?.trim();
  if (explicit) {
    const explicitPath = path.resolve(explicit);
    return existsSync(explicitPath) ? explicitPath : undefined;
  }

  for (const candidate of listUiEntrypointCandidates(cliPackageRoot)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function listUiEntrypointCandidates(cliPackageRoot: string): string[] {
  return [
    path.join(cliPackageRoot, "dist", "ui", "dist", "server", "index.js"),
    path.join(cliPackageRoot, "..", "ui", "dist", "server", "index.js"),
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

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat start [--port <number>] [--host <host>]\n");
  output.write("\n");
  output.write("Starts the OpenGoat UI server in production mode.\n");
  output.write(`Default host: ${DEFAULT_UI_HOST}\n`);
  output.write(`Default port: ${DEFAULT_UI_PORT}\n`);
}
