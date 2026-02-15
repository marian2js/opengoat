import { basename } from "node:path";

const TOOL_REGISTRATION_PATTERNS: readonly (readonly string[])[] = [
  ["gateway", "call", "agent"],
  ["gateway"],
  ["opengoat", "start"],
];
const FORCE_TOOL_REGISTRATION_ENV = "OPENGOAT_OPENCLAW_REGISTER_TOOLS";

export function shouldRegisterOpenGoatToolsForArgv(
  rawArgv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env[FORCE_TOOL_REGISTRATION_ENV]?.trim() === "1") {
    return true;
  }

  if (isGatewayServiceProcess(rawArgv, env)) {
    return true;
  }

  const args = normalizeArgv(rawArgv.slice(2));
  if (args.length === 0) {
    return false;
  }

  return TOOL_REGISTRATION_PATTERNS.some((pattern) =>
    containsContiguousSequence(args, pattern),
  );
}

function isGatewayServiceProcess(
  rawArgv: readonly string[],
  env: NodeJS.ProcessEnv,
): boolean {
  const executableTokens = [rawArgv[0], rawArgv[1]]
    .filter((value): value is string => typeof value === "string")
    .map((value) => basename(value).trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (executableTokens.some((value) => value.includes("openclaw-gateway"))) {
    return true;
  }

  if (
    env.OPENCLAW_SERVICE_KIND?.trim().toLowerCase() === "gateway" &&
    env.OPENCLAW_SERVICE_MARKER?.trim().toLowerCase() === "openclaw"
  ) {
    return true;
  }

  // LaunchAgent-managed gateway processes set both values. Guard this path so
  // unrelated CLI commands (for example, `openclaw plugins list`) do not
  // trigger OpenGoat tool registration.
  if (
    env.OPENCLAW_GATEWAY_PORT?.trim() &&
    env.OPENCLAW_GATEWAY_TOKEN?.trim() &&
    containsContiguousSequence(normalizeArgv(rawArgv.slice(2)), ["gateway"])
  ) {
    return true;
  }

  return false;
}

function normalizeArgv(tokens: readonly string[]): string[] {
  return tokens
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token !== "--");
}

function containsContiguousSequence(
  source: readonly string[],
  sequence: readonly string[],
): boolean {
  if (sequence.length === 0 || source.length < sequence.length) {
    return false;
  }

  for (let start = 0; start <= source.length - sequence.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (source[start + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }

  return false;
}
