import type { CliCommand } from "../framework/command.js";
import {
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

    await context.service.initialize();

    const prompter = createCliPrompter({
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    });

    try {
      let mode = parsed.mode;
      let gatewayUrl = parsed.gatewayUrl;
      let gatewayToken = parsed.gatewayToken;

      if (!parsed.nonInteractive) {
        await prompter.intro("OpenGoat Onboarding");
        await prompter.note("All OpenGoat agents run as OpenClaw agents.", "Runtime");

        if (!mode) {
          mode = await prompter.select(
            "Select OpenClaw connection mode",
            [
              { value: "local", label: "Local Gateway", hint: "Use local OpenClaw runtime." },
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

      const config =
        resolvedMode === "external"
          ? await context.service.setOpenClawGatewayConfig({
              mode: "external",
              gatewayUrl,
              gatewayToken
            })
          : await context.service.setOpenClawGatewayConfig({ mode: "local" });

      if (!parsed.nonInteractive) {
        await prompter.outro("OpenClaw onboarding complete.");
      }

      context.stdout.write(`Mode: ${config.mode}\n`);
      if (config.mode === "external") {
        context.stdout.write(`Gateway URL: ${config.gatewayUrl}\n`);
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
