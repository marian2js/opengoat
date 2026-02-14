import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_COMMAND_TOKEN = "opengoat";

interface ResolveOpenGoatCommandParams {
  configuredCommand: string;
  invocationCwd?: string;
  pluginSource?: string;
}

export function resolveOpenGoatCommand(params: ResolveOpenGoatCommandParams): string {
  if (params.configuredCommand !== DEFAULT_COMMAND_TOKEN) {
    return params.configuredCommand;
  }

  const baseCwd = params.invocationCwd ?? process.cwd();
  const candidates = [resolve(baseCwd, "bin/opengoat")];

  if (params.pluginSource) {
    const pluginRoot = dirname(params.pluginSource);
    candidates.push(resolve(pluginRoot, "../../bin/opengoat"));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_COMMAND_TOKEN;
}
