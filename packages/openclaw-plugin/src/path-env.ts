import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import type { PluginLogger } from "./openclaw-types.js";

interface EnsureOpenGoatPathOptions {
  command?: string;
  pluginSource?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDir?: string;
  processExecPath?: string;
  processArgv?: readonly string[];
  includeProcessEnvPrefixes?: boolean;
  fileExists?: (path: string) => boolean;
  logger?: PluginLogger;
}

interface EnsureOpenGoatPathResult {
  alreadyAvailable: boolean;
  added: boolean;
  addedPath?: string;
}

export function ensureOpenGoatCommandOnPath(
  options: EnsureOpenGoatPathOptions = {},
): EnsureOpenGoatPathResult {
  const command = options.command?.trim() || "opengoat";
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const fileExists = options.fileExists ?? existsSync;
  const pathValue = env.PATH ?? "";

  if (isCommandOnPath(command, pathValue, platform, fileExists)) {
    return {
      alreadyAvailable: true,
      added: false,
    };
  }

  const existingEntries = splitPath(pathValue);
  const candidateBinDirs = resolveCandidateBinDirs(
    command,
    cwd,
    options.pluginSource,
    env,
    platform,
    options.homeDir ?? homedir(),
    options.processExecPath ?? process.execPath,
    options.processArgv ?? process.argv,
    options.includeProcessEnvPrefixes ?? true,
    fileExists,
  );

  for (const candidate of candidateBinDirs) {
    if (containsPathEntry(existingEntries, candidate, platform)) {
      continue;
    }

    env.PATH = [candidate, ...existingEntries].join(delimiter);
    options.logger?.info(
      `[opengoat-plugin] added ${candidate} to PATH so \`${command}\` is available.`,
    );
    return {
      alreadyAvailable: false,
      added: true,
      addedPath: candidate,
    };
  }

  options.logger?.warn(
    `[opengoat-plugin] ${command} command is not on PATH and no local bin candidate was found.`,
  );
  return {
    alreadyAvailable: false,
    added: false,
  };
}

function resolveCandidateBinDirs(
  command: string,
  cwd: string,
  pluginSource: string | undefined,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  homeDir: string,
  processExecPath: string,
  processArgv: readonly string[],
  includeProcessEnvPrefixes: boolean,
  fileExists: (path: string) => boolean,
): string[] {
  const roots = new Set<string>([resolve(cwd)]);
  if (pluginSource?.trim()) {
    roots.add(resolve(dirname(pluginSource)));
  }

  const candidateDirs: string[] = [];
  const commandNames = commandNamesForPlatform(command, platform);

  for (const root of roots) {
    for (const ancestor of iterateAncestors(root)) {
      const binDir = join(ancestor, "bin");
      if (containsCommand(binDir, commandNames, fileExists)) {
        candidateDirs.push(binDir);
      }

      const nodeModulesBinDir = join(ancestor, "node_modules", ".bin");
      if (containsCommand(nodeModulesBinDir, commandNames, fileExists)) {
        candidateDirs.push(nodeModulesBinDir);
      }
    }
  }

  for (const preferred of resolvePreferredBinDirs(
    env,
    platform,
    homeDir,
    processExecPath,
    processArgv,
    includeProcessEnvPrefixes,
  )) {
    if (containsCommand(preferred, commandNames, fileExists)) {
      candidateDirs.push(preferred);
    }
  }

  return dedupe(candidateDirs);
}

function resolvePreferredBinDirs(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  homeDir: string,
  processExecPath: string,
  processArgv: readonly string[],
  includeProcessEnvPrefixes: boolean,
): string[] {
  const preferred = [
    dirname(processExecPath),
    join(homeDir, ".npm-global", "bin"),
    join(homeDir, ".npm", "bin"),
    join(homeDir, ".local", "bin"),
    join(homeDir, ".volta", "bin"),
    join(homeDir, ".fnm", "current", "bin"),
    join(homeDir, ".asdf", "shims"),
    join(homeDir, "bin"),
  ];

  const openClawArgvPath = processArgv[1]?.trim();
  if (openClawArgvPath) {
    preferred.push(dirname(resolve(openClawArgvPath)));
  }

  const prefixCandidates = [
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
  ];
  if (includeProcessEnvPrefixes) {
    prefixCandidates.push(
      process.env.npm_config_prefix ?? "",
      process.env.NPM_CONFIG_PREFIX ?? "",
    );
  }

  for (const prefix of dedupe(prefixCandidates)) {
    if (!prefix) {
      continue;
    }
    preferred.push(join(prefix, "bin"));
  }

  if (platform === "darwin") {
    preferred.push("/opt/homebrew/bin", "/usr/local/bin");
  }

  return dedupe(preferred.map((entry) => entry.trim()).filter(Boolean));
}

function isCommandOnPath(
  command: string,
  pathValue: string,
  platform: NodeJS.Platform,
  fileExists: (path: string) => boolean,
): boolean {
  const commandNames = commandNamesForPlatform(command, platform);

  for (const entry of splitPath(pathValue)) {
    if (containsCommand(entry, commandNames, fileExists)) {
      return true;
    }
  }

  return false;
}

function containsCommand(
  directory: string,
  commandNames: readonly string[],
  fileExists: (path: string) => boolean,
): boolean {
  for (const name of commandNames) {
    if (fileExists(join(directory, name))) {
      return true;
    }
  }

  return false;
}

function commandNamesForPlatform(
  command: string,
  platform: NodeJS.Platform,
): readonly string[] {
  return platform === "win32"
    ? [command, `${command}.cmd`, `${command}.exe`, `${command}.bat`]
    : [command];
}

function splitPath(pathValue: string): string[] {
  return pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function containsPathEntry(
  pathEntries: readonly string[],
  candidate: string,
  platform: NodeJS.Platform,
): boolean {
  const normalizedCandidate = normalizeForComparison(candidate, platform);
  return pathEntries.some(
    (entry) => normalizeForComparison(entry, platform) === normalizedCandidate,
  );
}

function normalizeForComparison(value: string, platform: NodeJS.Platform): string {
  const resolved = resolve(value);
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}

function *iterateAncestors(start: string): Generator<string> {
  let current = resolve(start);
  while (true) {
    yield current;
    const next = dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }
}

function dedupe(entries: readonly string[]): string[] {
  return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean))];
}
