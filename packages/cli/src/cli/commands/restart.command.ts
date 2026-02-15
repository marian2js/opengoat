import type { CliCommand } from "../framework/command.js";
import {
  parseUiServerArgs,
  printUiEntrypointNotFound,
  printUiServerHelp,
  resolveUiServerConfig,
  runUiServerProcess,
  stopTrackedUiServer,
} from "./ui-server.command.shared.js";

export const restartCommand: CliCommand = {
  path: ["restart"],
  description: "Restart OpenGoat UI (stop + start production server).",
  async run(args, context): Promise<number> {
    const parsed = parseUiServerArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printUiServerHelp(context.stderr, "restart");
      return 1;
    }

    if (parsed.help) {
      printUiServerHelp(context.stdout, "restart");
      return 0;
    }

    const resolved = resolveUiServerConfig({
      port: parsed.port,
      host: parsed.host,
    });
    if (!resolved.ok) {
      printUiEntrypointNotFound(context.stderr, resolved.candidates);
      return 1;
    }

    const config = resolved.config;
    context.stdout.write(
      `Restarting OpenGoat UI at http://${config.host}:${config.port}\n`,
    );

    const stopResult = await stopTrackedUiServer(config);
    if (!stopResult.ok) {
      context.stderr.write(`${stopResult.error ?? "Failed to stop OpenGoat UI."}\n`);
      return 1;
    }
    if (stopResult.note) {
      context.stdout.write(`${stopResult.note}\n`);
    }

    context.stdout.write(
      "OpenClaw OpenGoat tools will be registered during startup.\n",
    );
    return runUiServerProcess(config, context, "restart");
  },
};
