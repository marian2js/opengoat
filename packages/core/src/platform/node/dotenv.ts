import { access, readFile } from "node:fs/promises";
import path from "node:path";

export async function loadDotEnv(params: {
  cwd?: string;
  filename?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<void> {
  const cwd = params.cwd ?? process.cwd();
  const filename = params.filename ?? ".env";
  const env = params.env ?? process.env;
  const envPath = path.join(cwd, filename);

  if (!(await exists(envPath))) {
    return;
  }

  const content = await readFile(envPath, "utf8");
  const parsed = parseDotEnv(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

export function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separator = normalized.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = normalized.slice(0, separator).trim();
    if (!key) {
      continue;
    }

    const rawValue = normalized.slice(separator + 1).trim();
    env[key] = parseDotEnvValue(rawValue);
  }

  return env;
}

function parseDotEnvValue(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    const quote = raw[0];
    const inner = raw.slice(1, -1);
    if (quote === "'") {
      return inner;
    }

    return inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  return raw;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
