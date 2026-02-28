import { homedir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";

export const MANAGED_OPENCLAW_PLUGIN_ID = "opengoat_shared_fs";
export const MANAGED_OPENCLAW_PLUGIN_DIR_NAME = MANAGED_OPENCLAW_PLUGIN_ID;
export const MANAGED_OPENCLAW_PLUGIN_TOOL_NAMES = [
  "opengoat_read",
  "opengoat_write",
  "opengoat_edit",
] as const;
export const OPENCLAW_CORE_FS_TOOL_DENY_LIST = [
  "read",
  "write",
  "edit",
] as const;

const OPENCLAW_PLUGIN_TEMPLATE_BASE_URL = new URL(
  "../templates/assets/openclaw-plugin/",
  import.meta.url,
);

export interface ManagedOpenClawPluginConfigMutationResult {
  config: Record<string, unknown>;
  changed: boolean;
  removedMissingLoadPaths: string[];
}

interface MutateManagedPluginConfigInput {
  rootConfig: Record<string, unknown>;
  managedPluginPath: string;
  opengoatHomeDir: string;
  existingLoadPathSet: ReadonlySet<string>;
}

export function readManagedOpenClawPluginManifestTemplate(): string {
  return readTemplateAsset("openclaw.plugin.json");
}

export function readManagedOpenClawPluginEntrypointTemplate(): string {
  return readTemplateAsset("index.js");
}

export function resolveOpenClawConfigPath(env: NodeJS.ProcessEnv): string {
  const explicitConfigPath = readOptionalString(env.OPENCLAW_CONFIG_PATH);
  if (explicitConfigPath) {
    return path.resolve(expandTilde(explicitConfigPath));
  }

  const explicitStateDir = readOptionalString(env.OPENCLAW_STATE_DIR);
  const stateDir = explicitStateDir
    ? path.resolve(expandTilde(explicitStateDir))
    : path.join(homedir(), ".openclaw");
  return path.join(stateDir, "openclaw.json");
}

export function mutateManagedOpenClawPluginConfig(
  input: MutateManagedPluginConfigInput,
): ManagedOpenClawPluginConfigMutationResult {
  const root = asRecord(input.rootConfig);
  const plugins = asRecord(root.plugins);
  const load = asRecord(plugins.load);
  const entries = asRecord(plugins.entries);

  const managedPluginPath = normalizeAbsolutePath(input.managedPluginPath);
  const opengoatHomeDir = normalizeAbsolutePath(input.opengoatHomeDir);

  const removedMissingLoadPaths: string[] = [];
  const nextLoadPaths: string[] = [];
  const seenLoadPaths = new Set<string>();

  for (const candidate of readStringArray(load.paths)) {
    const normalizedCandidate = normalizeAbsolutePath(candidate);
    if (!normalizedCandidate || seenLoadPaths.has(normalizedCandidate)) {
      continue;
    }
    if (input.existingLoadPathSet.has(normalizedCandidate)) {
      seenLoadPaths.add(normalizedCandidate);
      nextLoadPaths.push(normalizedCandidate);
      continue;
    }
    removedMissingLoadPaths.push(normalizedCandidate);
  }

  if (!seenLoadPaths.has(managedPluginPath)) {
    nextLoadPaths.push(managedPluginPath);
  }

  const managedEntry = asRecord(entries[MANAGED_OPENCLAW_PLUGIN_ID]);
  const managedEntryConfig = asRecord(managedEntry.config);
  const nextEntries: Record<string, unknown> = {
    ...entries,
    [MANAGED_OPENCLAW_PLUGIN_ID]: {
      ...managedEntry,
      enabled: true,
      config: {
        ...managedEntryConfig,
        opengoatHomeDir,
      },
    },
  };

  const pluginIdLower = MANAGED_OPENCLAW_PLUGIN_ID.toLowerCase();
  const allowWasConfigured = Array.isArray(plugins.allow);
  const nextAllow = allowWasConfigured
    ? buildNormalizedStringArray(plugins.allow, (value) => value)
    : [];
  if (
    allowWasConfigured &&
    !nextAllow.some((value) => value.toLowerCase() === pluginIdLower)
  ) {
    nextAllow.push(MANAGED_OPENCLAW_PLUGIN_ID);
  }

  const denyWasConfigured = Array.isArray(plugins.deny);
  const nextDeny = denyWasConfigured
    ? buildNormalizedStringArray(plugins.deny, (value) => value).filter(
        (value) => value.toLowerCase() !== pluginIdLower,
      )
    : [];

  const nextPlugins: Record<string, unknown> = {
    ...plugins,
    enabled: true,
    load: {
      ...load,
      paths: nextLoadPaths,
    },
    entries: nextEntries,
  };
  if (allowWasConfigured) {
    nextPlugins.allow = nextAllow;
  }
  if (denyWasConfigured) {
    nextPlugins.deny = nextDeny;
  }

  const nextConfig: Record<string, unknown> = {
    ...root,
    plugins: nextPlugins,
  };

  const changed =
    JSON.stringify(root) !== JSON.stringify(nextConfig);

  return {
    config: nextConfig,
    changed,
    removedMissingLoadPaths,
  };
}

export function hasCoreFsToolsDenied(entry: Record<string, unknown>): boolean {
  const tools = asRecord(entry.tools);
  const deny = buildNormalizedStringArray(tools.deny, normalizeToolName);
  return OPENCLAW_CORE_FS_TOOL_DENY_LIST.every((name) =>
    deny.includes(name),
  );
}

export function mergeCoreFsToolsDenied(existingValue: unknown): string[] {
  const deny = buildNormalizedStringArray(existingValue, normalizeToolName);
  for (const toolName of OPENCLAW_CORE_FS_TOOL_DENY_LIST) {
    if (!deny.includes(toolName)) {
      deny.push(toolName);
    }
  }
  return deny;
}

function readTemplateAsset(fileName: string): string {
  return readFileSync(
    new URL(fileName, OPENCLAW_PLUGIN_TEMPLATE_BASE_URL),
    "utf-8",
  )
    .replace(/\r\n/g, "\n")
    .trimEnd();
}

function buildNormalizedStringArray(
  value: unknown,
  normalize: (value: string) => string,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const normalized = normalize(entry.trim());
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    entries.push(normalized);
  }
  return entries;
}

function normalizeToolName(value: string): string {
  return value.trim().toLowerCase();
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function normalizeAbsolutePath(rawPath: string): string {
  return path.resolve(expandTilde(rawPath.trim()));
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function expandTilde(value: string): string {
  if (!value.startsWith("~")) {
    return value;
  }

  if (value === "~") {
    return homedir();
  }

  return path.join(homedir(), value.slice(2));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
