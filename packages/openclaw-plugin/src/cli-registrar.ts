import { buildOpenGoatArgv, extractForwardedArgs } from "./argv.js";
import { resolveOpenGoatCommand } from "./command.js";
import type { OpenGoatPluginConfig } from "./config.js";
import type { PluginCliRegistrarLike, PluginLogger } from "./openclaw-types.js";
import type { OpenGoatRunRequest, OpenGoatRunResult } from "./process-runner.js";

export type OpenGoatRunner = (request: OpenGoatRunRequest) => Promise<OpenGoatRunResult>;

interface CreateOpenGoatCliRegistrarParams {
  logger: PluginLogger;
  config: OpenGoatPluginConfig;
  runOpenGoat: OpenGoatRunner;
  pluginSource?: string;
  commandName?: string;
}

export function createOpenGoatCliRegistrar(
  params: CreateOpenGoatCliRegistrarParams,
): PluginCliRegistrarLike {
  const commandName = params.commandName ?? "opengoat";

  return ({ program }) => {
    program
      .command(commandName)
      .description("Run OpenGoat as an alternative CLI path from OpenClaw.")
      .allowUnknownOption(true)
      .allowExcessArguments(true)
      .argument("[args...]", "Arguments forwarded to OpenGoat. Use `--` for OpenGoat flags.")
      .action(async () => {
        const forwardedArgs = extractForwardedArgs(process.argv, commandName);
        const args = buildOpenGoatArgv(params.config.baseArgs, forwardedArgs);
        const command = resolveOpenGoatCommand({
          configuredCommand: params.config.command,
          invocationCwd: params.config.cwd,
          pluginSource: params.pluginSource,
        });

        try {
          const result = await params.runOpenGoat({
            command,
            args,
            cwd: params.config.cwd,
            env: params.config.env,
          });

          if (result.signal) {
            params.logger.error(`OpenGoat terminated by signal: ${result.signal}`);
            process.exitCode = 1;
            return;
          }

          if (result.exitCode !== 0) {
            process.exitCode = result.exitCode;
          }
        } catch (error) {
          params.logger.error(`[opengoat-plugin] ${formatError(error)}`);
          process.exitCode = 1;
        }
      });
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
