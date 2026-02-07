import { OpenGoatService } from "../../core/opengoat/index.js";
import type { LogLevel, Logger } from "../../core/logging/index.js";
import type { OpenGoatPathsProvider } from "../../core/ports/paths-provider.port.js";
import { NodeFileSystem } from "../../platform/node/node-file-system.js";
import { createNodeLogger } from "../../platform/node/node-logger.js";
import { NodeCommandRunner } from "../../platform/node/node-command-runner.js";
import { NodeOpenGoatPathsProvider, NodePathPort } from "../../platform/node/node-path.port.js";

export interface OpenGoatRuntimeOptions {
  logger?: Logger;
  logLevel?: LogLevel;
  logFormat?: "pretty" | "json";
  pathsProvider?: OpenGoatPathsProvider;
}

export interface OpenGoatRuntime {
  service: OpenGoatService;
  logger: Logger;
}

export function createOpenGoatRuntime(options: OpenGoatRuntimeOptions = {}): OpenGoatRuntime {
  const logger =
    options.logger ??
    createNodeLogger({
      level: options.logLevel,
      format: options.logFormat
    });

  return {
    logger,
    service: new OpenGoatService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      pathsProvider: options.pathsProvider ?? new NodeOpenGoatPathsProvider(),
      commandRunner: new NodeCommandRunner(),
      logger
    })
  };
}
