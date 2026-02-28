import { spawn } from "node:child_process";
import type { CliCommand } from "../framework/command.js";
import {
  type CliPrompter,
  createCliPrompter,
  PromptCancelledError
} from "../framework/prompter.js";

export const onboardCommand: CliCommand = {
  path: ["onboard"],
  description: "Configure OpenClaw gateway connection (local or external).",
  async run(args, context): Promise<number> {
    const parsed = parseOnboardArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    let mode = parsed.mode;
    let gatewayUrl = parsed.gatewayUrl;
    let gatewayToken = parsed.gatewayToken;
    const hasCompleteExternalConfig = Boolean(gatewayUrl && gatewayToken);
    if (
      parsed.nonInteractive &&
      mode === "external" &&
      !hasCompleteExternalConfig
    ) {
      context.stderr.write(
        "External mode requires --gateway-url and --gateway-token.\n",
      );
      return 1;
    }

    await context.service.initialize();

    const prompter = createCliPrompter({
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    });

    try {
      if (!parsed.nonInteractive) {
        await prompter.intro("OpenGoat Onboarding");
        await prompter.note("All OpenGoat agents run as OpenClaw agents.", "Runtime");

        if (!mode) {
          mode = await prompter.select(
            "Select OpenClaw connection mode",
            [
              { value: "local", label: "Local Gateway (Recommended)", hint: "Use local OpenClaw runtime." },
              { value: "external", label: "External Gateway", hint: "Connect to a remote OpenClaw gateway." }
            ],
            "local"
          );
        }

        if (mode === "external") {
          if (!gatewayUrl) {
            gatewayUrl = (
              await prompter.text({
                message: "External gateway URL",
                placeholder: "ws://host:port"
              })
            ).trim();
          }
          if (!gatewayToken) {
            gatewayToken = (
              await prompter.text({
                message: "External gateway token",
                required: true,
                secret: true
              })
            ).trim();
          }
        }
      }

      const resolvedMode = mode ?? "local";
      if (resolvedMode === "external" && (!gatewayUrl || !gatewayToken)) {
        context.stderr.write("External mode requires --gateway-url and --gateway-token.\n");
        return 1;
      }

      if (resolvedMode === "local" && !parsed.nonInteractive) {
        const ready = await prepareLocalOpenClawGateway(context, prompter);
        if (!ready) {
          return 1;
        }
      }

      const config =
        resolvedMode === "external"
          ? await context.service.setOpenClawGatewayConfig({
              mode: "external",
              gatewayUrl,
              gatewayToken
            })
          : await context.service.setOpenClawGatewayConfig({ mode: "local" });
      const runtimeSync = await context.service.syncRuntimeDefaults?.();

      if (!parsed.nonInteractive) {
        await prompter.outro("OpenClaw onboarding complete.");
      }

      context.stdout.write(`Mode: ${config.mode}\n`);
      if (config.mode === "external") {
        context.stdout.write(`Gateway URL: ${config.gatewayUrl}\n`);
      }
      if (runtimeSync) {
        context.stdout.write(
          `OpenClaw default sync: goat=${runtimeSync.ceoSynced ? "ok" : "failed"}`
        );
        if (typeof runtimeSync.ceoSyncCode === "number") {
          context.stdout.write(` (code ${runtimeSync.ceoSyncCode})`);
        }
        context.stdout.write("\n");
        for (const warning of runtimeSync.warnings) {
          context.stderr.write(`${warning}\n`);
        }
      }
      context.stdout.write(
        `Saved runtime config: ${context.service.getPaths().providersDir}/openclaw/config.json\n`
      );
      return 0;
    } catch (error) {
      if (error instanceof PromptCancelledError) {
        return 0;
      }
      throw error;
    }
  }
};

type ParsedOnboardArgs =
  | {
      ok: true;
      help: boolean;
      nonInteractive: boolean;
      mode?: "local" | "external";
      gatewayUrl?: string;
      gatewayToken?: string;
    }
  | {
      ok: false;
      error: string;
    };

function parseOnboardArgs(args: string[]): ParsedOnboardArgs {
  let help = false;
  let nonInteractive = false;
  let mode: "local" | "external" | undefined;
  let gatewayUrl: string | undefined;
  let gatewayToken: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }

    if (token === "--non-interactive") {
      nonInteractive = true;
      continue;
    }

    if (token === "--local") {
      mode = "local";
      continue;
    }

    if (token === "--external") {
      mode = "external";
      continue;
    }

    if (token === "--gateway-url") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --gateway-url." };
      }
      gatewayUrl = value;
      index += 1;
      continue;
    }

    if (token === "--gateway-token") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --gateway-token." };
      }
      gatewayToken = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (mode === "local" && (gatewayUrl || gatewayToken)) {
    return { ok: false, error: "--gateway-url/--gateway-token are only valid with --external." };
  }

  return {
    ok: true,
    help,
    nonInteractive,
    mode,
    gatewayUrl,
    gatewayToken
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat onboard [--local|--external] [--gateway-url <url>] [--gateway-token <token>] [--non-interactive]\n");
  output.write("\n");
  output.write("Examples:\n");
  output.write("  opengoat onboard\n");
  output.write("  opengoat onboard --local --non-interactive\n");
  output.write("  opengoat onboard --external --gateway-url ws://host:18789 --gateway-token <token> --non-interactive\n");
}

async function prepareLocalOpenClawGateway(
  context: Parameters<NonNullable<CliCommand["run"]>>[1],
  prompter: CliPrompter
): Promise<boolean> {
  const cliState = await checkOpenClawCli(context);
  if (!cliState.installed) {
    const shouldInstall = await prompter.confirm({
      message: "OpenClaw CLI is not installed. Install it now?",
      initialValue: true
    });

    if (!shouldInstall) {
      await prompter.note(
        "Install OpenClaw CLI first: npm i -g openclaw@latest",
        "Gateway"
      );
      return false;
    }

    const installResult = await runInteractiveCommand("npm", ["i", "-g", "openclaw@latest"]);
    if (installResult.code !== 0) {
      await prompter.note(
        `OpenClaw install failed (exit ${installResult.code}).`,
        "Gateway"
      );
      return false;
    }
  }

  const gatewayRunning = await isLocalGatewayRunning(context);
  if (gatewayRunning) {
    await prompter.note("OpenClaw CLI is installed and gateway is running.", "Gateway");
    return true;
  }

  await prompter.note("OpenClaw CLI is installed, but gateway is not running.", "Gateway");
  const shouldRunOnboard = await prompter.confirm({
    message: "Run openclaw onboard now?",
    initialValue: true
  });

  if (!shouldRunOnboard) {
    return true;
  }

  const openClawCommand = resolveOpenClawCommand();
  const onboardResult = await runInteractiveCommand(openClawCommand, ["onboard"]);
  if (onboardResult.code !== 0) {
    await prompter.note(
      `openclaw onboard failed (exit ${onboardResult.code}).`,
      "Gateway"
    );
    return false;
  }

  return true;
}

async function checkOpenClawCli(
  context: Parameters<NonNullable<CliCommand["run"]>>[1]
): Promise<{ installed: boolean }> {
  try {
    const result = await context.service.runOpenClaw(["--version"]);
    return {
      installed: result.code === 0
    };
  } catch (error) {
    if (isCommandMissingError(error)) {
      return { installed: false };
    }

    throw error;
  }
}

async function isLocalGatewayRunning(
  context: Parameters<NonNullable<CliCommand["run"]>>[1]
): Promise<boolean> {
  const result = await context.service.runOpenClaw(["gateway", "status", "--json", "--no-probe"]);
  if (result.code !== 0) {
    return false;
  }

  const status = parseJson<{ port?: { status?: string } }>(result.stdout);
  return status?.port?.status === "listening";
}

function resolveOpenClawCommand(): string {
  return (
    process.env.OPENGOAT_OPENCLAW_CMD?.trim() ||
    process.env.OPENCLAW_CMD?.trim() ||
    "openclaw"
  );
}

async function runInteractiveCommand(command: string, args: string[]): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", () => {
      resolve({ code: 1 });
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1 });
    });
  });
}

function parseJson<T>(raw: string): T | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}

function isCommandMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "EACCES";
}
