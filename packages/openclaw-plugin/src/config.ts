export interface OpenGoatPluginConfig {
  command: string;
  baseArgs: string[];
  cwd?: string;
  env: Record<string, string>;
}

const DEFAULT_OPENGOAT_COMMAND = "opengoat";
const ENV_OPENGOAT_COMMAND = "OPENGOAT_PLUGIN_COMMAND";

export function parseOpenGoatPluginConfig(
  raw: unknown,
  env: NodeJS.ProcessEnv = process.env,
): OpenGoatPluginConfig {
  const record = isRecord(raw) ? raw : {};

  const command =
    asNonEmptyString(record.command) ??
    asNonEmptyString(env[ENV_OPENGOAT_COMMAND]) ??
    DEFAULT_OPENGOAT_COMMAND;

  return {
    command,
    baseArgs: readStringArray(record.baseArgs),
    cwd: asNonEmptyString(record.cwd),
    env: readStringMap(record.env),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => typeof entry === "string");
}

function readStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const stringValue = asNonEmptyString(rawValue);
    if (!stringValue) {
      continue;
    }
    result[key] = stringValue;
  }

  return result;
}
