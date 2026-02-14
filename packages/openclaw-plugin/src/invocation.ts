const TOOL_REGISTRATION_PATTERNS: readonly (readonly string[])[] = [
  ["gateway", "call", "agent"],
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

  const args = normalizeArgv(rawArgv.slice(2));
  if (args.length === 0) {
    return false;
  }

  return TOOL_REGISTRATION_PATTERNS.some((pattern) =>
    containsContiguousSequence(args, pattern),
  );
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
