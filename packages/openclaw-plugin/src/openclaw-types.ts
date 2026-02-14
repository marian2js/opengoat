export interface PluginLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug?(message: string): void;
}

export interface CliCommandLike {
  description(text: string): CliCommandLike;
  allowUnknownOption(allow?: boolean): CliCommandLike;
  allowExcessArguments(allow?: boolean): CliCommandLike;
  passThroughOptions(allow?: boolean): CliCommandLike;
  argument(definition: string, description?: string): CliCommandLike;
  action(handler: (...args: unknown[]) => void | Promise<void>): CliCommandLike;
}

export interface CliProgramLike {
  command(nameAndArgs: string): CliCommandLike;
}

export interface PluginCliContextLike {
  program: CliProgramLike;
}

export type PluginCliRegistrarLike = (context: PluginCliContextLike) => void | Promise<void>;

export interface OpenClawPluginApiLike {
  source: string;
  pluginConfig?: Record<string, unknown>;
  logger: PluginLogger;
  registerCli(registrar: PluginCliRegistrarLike, opts?: { commands?: string[] }): void;
}
