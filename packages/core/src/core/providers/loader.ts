import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ProviderModule } from "./provider-module.js";
import type { ProviderRegistry } from "./registry.js";

const providersRootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "providers");

export async function loadProviderModules(registry: ProviderRegistry): Promise<void> {
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

    const providerModules = resolveProviderModules(imported);
    if (providerModules.length === 0) {
      continue;
    }

    for (const providerModule of providerModules) {
      registry.register(providerModule.id, providerModule.create, providerModule);
    }
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
