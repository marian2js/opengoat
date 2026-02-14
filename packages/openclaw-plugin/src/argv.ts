export function extractForwardedArgs(rawArgv: readonly string[], commandName: string): string[] {
  const commandIndex = rawArgv.findIndex((token, index) => index >= 2 && token === commandName);
  if (commandIndex === -1) {
    return [];
  }

  return normalizeForwardedArgs(rawArgv.slice(commandIndex + 1));
}

export function buildOpenGoatArgv(
  baseArgs: readonly string[],
  forwardedArgs: readonly string[],
): string[] {
  return [...baseArgs, ...normalizeForwardedArgs(forwardedArgs)];
}

function normalizeForwardedArgs(args: readonly string[]): string[] {
  if (args[0] === "--") {
    return args.slice(1);
  }
  return [...args];
}
