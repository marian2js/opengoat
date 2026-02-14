import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENGOAT_PACKAGE_NAME,
  VERSION_CACHE_TTL_MS,
  VERSION_CHECK_TIMEOUT_MS,
} from "./constants.js";
import type { UiVersionInfo } from "./types.js";

export function createVersionInfoProvider(): () => Promise<UiVersionInfo> {
  let cached: UiVersionInfo | null = null;
  let expiresAt = 0;
  let pending: Promise<UiVersionInfo> | null = null;

  return async () => {
    const now = Date.now();
    if (cached && now < expiresAt) {
      return cached;
    }

    if (pending) {
      return pending;
    }

    pending = (async () => {
      const installedVersion = resolveInstalledVersion();
      let latestVersion: string | null = null;
      let unpublished = false;
      let error: string | undefined;

      try {
        latestVersion = await fetchLatestPackageVersion(OPENGOAT_PACKAGE_NAME);
      } catch (fetchError) {
        if (fetchError instanceof NpmPackageNotFoundError) {
          unpublished = true;
        } else {
          error =
            fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }

      const status = resolveVersionStatus(
        installedVersion,
        latestVersion,
        unpublished,
      );
      const next: UiVersionInfo = {
        packageName: OPENGOAT_PACKAGE_NAME,
        installedVersion,
        latestVersion,
        updateAvailable: status.updateAvailable,
        status: status.status,
        checkedAt: new Date().toISOString(),
        error,
      };

      cached = next;
      expiresAt = Date.now() + VERSION_CACHE_TTL_MS;
      return next;
    })();

    try {
      return await pending;
    } finally {
      pending = null;
    }
  };
}

export function resolveMode(): "development" | "production" {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function resolvePackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "../../..");
}

function resolveInstalledVersion(): string | null {
  const envVersion = normalizeVersion(process.env.OPENGOAT_VERSION);
  if (envVersion) {
    return envVersion;
  }

  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  const candidates = dedupePathEntries([
    path.resolve(process.cwd(), "packages", "cli", "package.json"),
    path.resolve(currentDir, "../../../../../packages/cli/package.json"),
    path.resolve(currentDir, "../../../../../../packages/cli/package.json"),
    path.resolve(process.cwd(), "package.json"),
    path.resolve(currentDir, "../../../../../package.json"),
    path.resolve(currentDir, "../../../../../../package.json"),
  ]);

  for (const packageJsonPath of candidates) {
    const version = readOpengoatPackageVersion(packageJsonPath);
    if (version) {
      return version;
    }
  }

  for (const packageJsonPath of candidates) {
    const version = readAnyPackageVersion(packageJsonPath);
    if (version) {
      return version;
    }
  }

  return null;
}

function readOpengoatPackageVersion(packageJsonPath: string): string | null {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      name?: string;
      version?: string;
      bin?: Record<string, unknown>;
    };
    const isCliPackage =
      parsed.name === OPENGOAT_PACKAGE_NAME ||
      parsed.name === "@opengoat/cli" ||
      Boolean(
        parsed.bin && typeof parsed.bin === "object" && "opengoat" in parsed.bin,
      );
    if (!isCliPackage) {
      return null;
    }
    return normalizeVersion(parsed.version) ?? null;
  } catch {
    return null;
  }
}

function readAnyPackageVersion(packageJsonPath: string): string | null {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      version?: string;
    };
    return normalizeVersion(parsed.version) ?? null;
  } catch {
    return null;
  }
}

function normalizeVersion(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveVersionStatus(
  installedVersion: string | null,
  latestVersion: string | null,
  unpublished: boolean,
): { updateAvailable: boolean | null; status: UiVersionInfo["status"] } {
  if (unpublished) {
    return {
      updateAvailable: null,
      status: "unpublished",
    };
  }

  if (!installedVersion || !latestVersion) {
    return {
      updateAvailable: null,
      status: "unknown",
    };
  }

  const comparison = compareVersionStrings(latestVersion, installedVersion);
  if (comparison > 0) {
    return {
      updateAvailable: true,
      status: "update-available",
    };
  }

  return {
    updateAvailable: false,
    status: "latest",
  };
}

async function fetchLatestPackageVersion(packageName: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, VERSION_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (response.status === 404) {
      throw new NpmPackageNotFoundError(
        `${packageName} is not published on npm yet.`,
      );
    }

    if (!response.ok) {
      throw new Error("Unable to check npm registry for updates.");
    }

    const payload = (await response.json()) as {
      version?: string;
    };
    const version = normalizeVersion(payload.version);
    if (!version) {
      throw new Error("npm registry response did not include a version.");
    }
    return version;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out while checking npm for updates.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class NpmPackageNotFoundError extends Error {}

function compareVersionStrings(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function parseVersionParts(version: string): number[] {
  return version
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment) && segment >= 0);
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    result.push(entry);
  }

  return result;
}
