import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ProviderModule } from "./provider-module.js";
import type { ProviderRegistry } from "./registry.js";
import { providerModule as claudeProviderModule } from "./providers/claude/index.js";
import { providerModule as codexProviderModule } from "./providers/codex/index.js";
import { providerModule as cursorProviderModule } from "./providers/cursor/index.js";
import { providerModule as geminiProviderModule } from "./providers/gemini/index.js";
import { providerModule as grokProviderModule } from "./providers/grok/index.js";
import { providerModule as openaiProviderModule } from "./providers/openai/index.js";
import { providerModule as openclawProviderModule } from "./providers/openclaw/index.js";
import { providerModules as extendedHttpProviderModules } from "./providers/extended-http/index.js";
import { providerModule as opencodeProviderModule } from "./providers/opencode/index.js";
import { providerModule as openrouterProviderModule } from "./providers/openrouter/index.js";

const providersRootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "providers");
const staticProviderModules: ProviderModule[] = [
  claudeProviderModule,
  codexProviderModule,
  cursorProviderModule,
  geminiProviderModule,
  grokProviderModule,
  openaiProviderModule,
  openclawProviderModule,
  opencodeProviderModule,
  openrouterProviderModule,
  ...extendedHttpProviderModules
];

export async function loadProviderModules(registry: ProviderRegistry): Promise<void> {
  let loadedCount = 0;
  let providersDirMissing = false;

  try {
    const entries = await readdir(providersRootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const providerDir = path.join(providersRootDir, entry.name);
      const modulePath = await resolveModulePath(providerDir);
      if (!modulePath) {
        continue;
      }

      const imported = (await import(pathToFileURL(modulePath).href)) as {
        providerModule?: ProviderModule;
        providerModules?: ProviderModule[];
      };

      loadedCount += registerProviderModules(registry, resolveProviderModules(imported));
    }
  } catch (error) {
    if (!isMissingProvidersDirError(error)) {
      throw error;
    }
    providersDirMissing = true;
  }

  if (providersDirMissing || loadedCount === 0) {
    registerProviderModules(registry, staticProviderModules);
  }
}

function resolveProviderModules(imported: {
  providerModule?: ProviderModule;
  providerModules?: ProviderModule[];
}): ProviderModule[] {
  if (Array.isArray(imported.providerModules) && imported.providerModules.length > 0) {
    return imported.providerModules;
  }

  if (imported.providerModule) {
    return [imported.providerModule];
  }

  return [];
}

function registerProviderModules(registry: ProviderRegistry, providerModules: ProviderModule[]): number {
  if (providerModules.length === 0) {
    return 0;
  }

  for (const providerModule of providerModules) {
    registry.register(providerModule.id, providerModule.create, providerModule);
  }
  return providerModules.length;
}

async function resolveModulePath(providerDir: string): Promise<string | null> {
  const candidates = ["index.js", "index.ts"];

  for (const candidate of candidates) {
    const fullPath = path.join(providerDir, candidate);
    if (await exists(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingProvidersDirError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const withCode = error as Error & { code?: string };
  return withCode.code === "ENOENT";
}
