import type { CliCommand } from "../framework/command.js";
import { startOpenGoatGatewayServer } from "@opengoat/core";

export const gatewayCommand: CliCommand = {
  path: ["gateway"],
  description: "Run optional OpenGoat Gateway for secure remote app connections.",
  async run(args, context): Promise<number> {
    const parsed = parseGatewayArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    const bindIsLoopback = isLoopbackHost(parsed.bindHost);
    if (!bindIsLoopback && !parsed.allowRemote) {
      context.stderr.write(
        "Refusing non-loopback bind without --allow-remote. Keep loopback and tunnel (SSH/Tailscale) whenever possible.\n"
      );
      return 1;
    }

    if (!bindIsLoopback && parsed.noAuth) {
      context.stderr.write("Refusing --no-auth on non-loopback bind.\n");
      return 1;
    }

    await context.service.initialize();
    const logger = parsed.verbose
      ? {
          info: (message: string) => context.stderr.write(`[gateway] ${message}\n`),
          warn: (message: string) => context.stderr.write(`[gateway][warn] ${message}\n`),
          error: (message: string) => context.stderr.write(`[gateway][error] ${message}\n`),
          debug: (message: string) => context.stderr.write(`[gateway][debug] ${message}\n`)
        }
      : undefined;

    const server = await startOpenGoatGatewayServer(context.service, {
      port: parsed.port,
      bindHost: parsed.bindHost,
      authToken: parsed.token,
      requireAuth: !parsed.noAuth,
      allowedOrigins: parsed.allowedOrigins,
      logger
    });

    context.stdout.write(
      "OpenGoat Gateway is optional and only needed when OpenGoat is running on a remote machine.\n"
    );
    context.stdout.write(`Gateway URL: ${server.url}\n`);
    if (server.authToken) {
      context.stdout.write(`Gateway token: ${server.authToken}\n`);
    } else {
      context.stdout.write("Gateway auth: disabled (loopback only recommended).\n");
    }

    if (!bindIsLoopback) {
      context.stdout.write(
        "Security note: prefer loopback + SSH/Tailscale tunnel instead of direct LAN/WAN exposure.\n"
      );
    }

    const close = async () => {
      await server.close();
    };

    const onSigInt = () => {
      void close();
    };
    const onSigTerm = () => {
      void close();
    };

    process.once("SIGINT", onSigInt);
    process.once("SIGTERM", onSigTerm);

    try {
      await server.closed;
    } finally {
      process.off("SIGINT", onSigInt);
      process.off("SIGTERM", onSigTerm);
    }

    return 0;
  }
};

type ParsedGatewayArgs =
  | {
      ok: true;
      help: boolean;
      verbose: boolean;
      allowRemote: boolean;
      noAuth: boolean;
      bindHost: string;
      port: number;
      token?: string;
      allowedOrigins: string[];
    }
  | {
      ok: false;
      error: string;
    };

function parseGatewayArgs(args: string[]): ParsedGatewayArgs {
  let help = false;
  let verbose = false;
  let allowRemote = false;
  let noAuth = false;
  let bindHost = "127.0.0.1";
  let port = 18789;
  let token: string | undefined;
  const allowedOrigins: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const tokenArg = args[index];
    if (!tokenArg) {
      continue;
    }
    if (tokenArg === "--help" || tokenArg === "-h" || tokenArg === "help") {
      help = true;
      continue;
    }

    if (tokenArg === "--verbose" || tokenArg === "-v") {
      verbose = true;
      continue;
    }

    if (tokenArg === "--allow-remote") {
      allowRemote = true;
      continue;
    }

    if (tokenArg === "--no-auth") {
      noAuth = true;
      continue;
    }

    if (tokenArg === "--port") {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        return { ok: false, error: "Invalid value for --port (must be 1-65535)." };
      }
      port = value;
      index += 1;
      continue;
    }

    if (tokenArg.startsWith("--port=")) {
      const value = Number(tokenArg.slice("--port=".length));
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        return { ok: false, error: "Invalid value for --port (must be 1-65535)." };
      }
      port = value;
      continue;
    }

    if (tokenArg === "--bind") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --bind." };
      }
      bindHost = value;
      index += 1;
      continue;
    }

    if (tokenArg.startsWith("--bind=")) {
      const value = tokenArg.slice("--bind=".length).trim();
      if (!value) {
        return { ok: false, error: "Missing value for --bind." };
      }
      bindHost = value;
      continue;
    }

    if (tokenArg === "--token") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --token." };
      }
      token = value;
      index += 1;
      continue;
    }

    if (tokenArg.startsWith("--token=")) {
      const value = tokenArg.slice("--token=".length).trim();
      if (!value) {
        return { ok: false, error: "Missing value for --token." };
      }
      token = value;
      continue;
    }

    if (tokenArg === "--allow-origin") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --allow-origin." };
      }
      allowedOrigins.push(value);
      index += 1;
      continue;
    }

    if (tokenArg.startsWith("--allow-origin=")) {
      const value = tokenArg.slice("--allow-origin=".length).trim();
      if (!value) {
        return { ok: false, error: "Missing value for --allow-origin." };
      }
      allowedOrigins.push(value);
      continue;
    }

    return { ok: false, error: `Unknown option: ${tokenArg}` };
  }

  return {
    ok: true,
    help,
    verbose,
    allowRemote,
    noAuth,
    bindHost,
    port,
    token,
    allowedOrigins
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat gateway [--port <1-65535>] [--bind <host>] [--token <value>] [--allow-origin <origin>] [--allow-remote] [--no-auth] [--verbose]\n"
  );
  output.write("\n");
  output.write("Starts the optional OpenGoat Gateway (WebSocket + /health HTTP) for remote app control.\n");
  output.write("Local OpenGoat usage does not require this gateway.\n");
  output.write("\n");
  output.write("Security defaults:\n");
  output.write("  - binds to 127.0.0.1\n");
  output.write("  - authentication enabled by default\n");
  output.write("  - non-loopback bind requires --allow-remote\n");
  output.write("  - --no-auth is rejected on non-loopback binds\n");
}

function isLoopbackHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return (
    value === "127.0.0.1" ||
    value.startsWith("127.") ||
    value === "::1" ||
    value === "localhost" ||
    value.startsWith("::ffff:127.")
  );
}
