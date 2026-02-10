import { createOpenGoatRuntime } from "@opengoat/core";
import type { OpenGoatService } from "@opengoat/core";
import type { LogLevel } from "@opengoat/core";
import { acpCommand } from "./commands/acp.command.js";
import { agentCommand } from "./commands/agent.command.js";
import { agentCreateCommand } from "./commands/agent-create.command.js";
import { agentDeleteCommand } from "./commands/agent-delete.command.js";
import { agentListCommand } from "./commands/agent-list.command.js";
import { agentProviderGetCommand } from "./commands/agent-provider-get.command.js";
import { agentProviderSetCommand } from "./commands/agent-provider-set.command.js";
import { agentRunCommand } from "./commands/agent-run.command.js";
import { agentSetManagerCommand } from "./commands/agent-set-manager.command.js";
import { initCommand } from "./commands/init.command.js";
import { onboardCommand } from "./commands/onboard.command.js";
import { providerCommand } from "./commands/provider.command.js";
import { providerListCommand } from "./commands/provider-list.command.js";
import { routeCommand } from "./commands/route.command.js";
import { scenarioCommand } from "./commands/scenario.command.js";
import { scenarioRunCommand } from "./commands/scenario-run.command.js";
import { skillCommand } from "./commands/skill.command.js";
import { skillInstallCommand } from "./commands/skill-install.command.js";
import { skillListCommand } from "./commands/skill-list.command.js";
import { sessionCommand } from "./commands/session.command.js";
import { sessionCompactCommand } from "./commands/session-compact.command.js";
import { sessionHistoryCommand } from "./commands/session-history.command.js";
import { sessionListCommand } from "./commands/session-list.command.js";
import { sessionRemoveCommand } from "./commands/session-remove.command.js";
import { sessionRenameCommand } from "./commands/session-rename.command.js";
import { sessionResetCommand } from "./commands/session-reset.command.js";
import { CommandRouter } from "./framework/router.js";

export async function runCli(argv: string[]): Promise<number> {
  const globalOptions = parseGlobalCliOptions(argv);
  const runtime = createOpenGoatRuntime({
    logLevel: globalOptions.logLevel,
    logFormat: globalOptions.logFormat
  });
  const logger = runtime.logger.child({ scope: "cli" });

  const service = createLazyService(() => {
    return runtime.service;
  });

  const router = new CommandRouter(
    [
      initCommand,
      acpCommand,
      onboardCommand,
      routeCommand,
      scenarioCommand,
      scenarioRunCommand,
      providerCommand,
      providerListCommand,
      skillCommand,
      skillListCommand,
      skillInstallCommand,
      sessionCommand,
      sessionListCommand,
      sessionHistoryCommand,
      sessionResetCommand,
      sessionCompactCommand,
      sessionRenameCommand,
      sessionRemoveCommand,
      agentCommand,
      agentCreateCommand,
      agentDeleteCommand,
      agentSetManagerCommand,
      agentProviderGetCommand,
      agentProviderSetCommand,
      agentListCommand,
      agentRunCommand
    ],
    {
      service,
      stdout: process.stdout,
      stderr: process.stderr
    }
  );

  return router.dispatch(globalOptions.passthroughArgv);
}

interface GlobalCliOptions {
  passthroughArgv: string[];
  logLevel?: LogLevel;
  logFormat?: "pretty" | "json";
}

function parseGlobalCliOptions(argv: string[]): GlobalCliOptions {
  const passthrough: string[] = [];
  let logLevel: LogLevel | undefined;
  let logFormat: "pretty" | "json" | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === "--") {
      passthrough.push(...argv.slice(index));
      break;
    }

    if (token === "--log-level") {
      const value = argv[index + 1];
      if (!value || value === "--") {
        throw new Error("Missing value for --log-level.");
      }
      logLevel = parseLogLevel(value);
      index += 1;
      continue;
    }

    if (token.startsWith("--log-level=")) {
      logLevel = parseLogLevel(token.slice("--log-level=".length));
      continue;
    }

    if (token === "--log-format") {
      const value = argv[index + 1];
      if (!value || value === "--") {
        throw new Error("Missing value for --log-format.");
      }
      logFormat = parseLogFormat(value);
      index += 1;
      continue;
    }

    if (token.startsWith("--log-format=")) {
      logFormat = parseLogFormat(token.slice("--log-format=".length));
      continue;
    }

    passthrough.push(token);
  }

  return {
    passthroughArgv: passthrough,
    logLevel,
    logFormat
  };
}

function parseLogLevel(raw: string): LogLevel {
  const value = raw.trim().toLowerCase();
  if (value === "silent" || value === "error" || value === "warn" || value === "info" || value === "debug") {
    return value;
  }
  throw new Error('Invalid --log-level. Use "silent", "error", "warn", "info", or "debug".');
}

function parseLogFormat(raw: string): "pretty" | "json" {
  const value = raw.trim().toLowerCase();
  if (value === "pretty" || value === "json") {
    return value;
  }
  throw new Error('Invalid --log-format. Use "pretty" or "json".');
}

function createLazyService(factory: () => OpenGoatService): OpenGoatService {
  let instance: OpenGoatService | undefined;

  const ensureInstance = (): OpenGoatService => {
    if (!instance) {
      instance = factory();
    }
    return instance;
  };

  return new Proxy({} as OpenGoatService, {
    get(_target, property, receiver) {
      const value = Reflect.get(ensureInstance() as object, property, receiver);
      if (typeof value === "function") {
        return value.bind(ensureInstance());
      }
      return value;
    }
  });
}
