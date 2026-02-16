import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENGOAT_GITHUB_REPOSITORY,
  OPENGOAT_PACKAGE_NAME,
  VERSION_CACHE_TTL_MS,
  VERSION_CHECK_TIMEOUT_MS,
} from "./constants.js";
import type { UiVersionInfo, UiVersionSource } from "./types.js";

interface VersionCandidate {
  source: UiVersionSource;
  version: string;
}

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
      const checkedSources: UiVersionSource[] = [];
      const candidates: VersionCandidate[] = [];
      let npmPackageNotFound = false;
      const sourceErrors: string[] = [];

      const checkSource = async (
        source: UiVersionSource,
        fetchVersion: () => Promise<string>,
      ): Promise<void> => {
        checkedSources.push(source);
        try {
          const version = await fetchVersion();
          candidates.push({
            source,
            version,
          });
        } catch (sourceError) {
          if (sourceError instanceof VersionNotFoundError) {
            if (source === "npm") {
              npmPackageNotFound = true;
            }
            return;
          }
          const message =
            sourceError instanceof Error
              ? sourceError.message
              : String(sourceError);
          if (!sourceErrors.includes(message)) {
            sourceErrors.push(message);
          }
        }
      };

      await checkSource("npm", async () => {
        return fetchLatestPackageVersion(OPENGOAT_PACKAGE_NAME);
      });
      await checkSource("github-release", async () => {
        return fetchLatestGitHubReleaseVersion(OPENGOAT_GITHUB_REPOSITORY);
      });
      await checkSource("github-tag", async () => {
        return fetchLatestGitHubTagVersion(OPENGOAT_GITHUB_REPOSITORY);
      });

      const latestCandidate = resolveLatestReleaseCandidate(candidates);
      const latestVersion = latestCandidate?.version ?? null;
      const latestSource = latestCandidate?.source ?? null;
      const unpublished =
        !latestVersion && npmPackageNotFound && sourceErrors.length === 0;

      const status = resolveVersionStatus({
        installedVersion,
        latestVersion,
        unpublished,
      });
      const next: UiVersionInfo = {
        packageName: OPENGOAT_PACKAGE_NAME,
        installedVersion,
        latestVersion,
        updateAvailable: status.updateAvailable,
        status: status.status,
        latestSource,
        checkedSources,
        checkedAt: new Date().toISOString(),
        error: sourceErrors.length > 0 ? sourceErrors.join("; ") : undefined,
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
  if (!normalized) {
    return undefined;
  }
  return normalized.replace(/^v(?=\d)/i, "");
}

function resolveVersionStatus(
  input: {
    installedVersion: string | null;
    latestVersion: string | null;
    unpublished: boolean;
  },
): { updateAvailable: boolean | null; status: UiVersionInfo["status"] } {
  const { installedVersion, latestVersion, unpublished } = input;
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
  if (comparison < 0) {
    return {
      updateAvailable: false,
      status: "ahead",
    };
  }

  return {
    updateAvailable: false,
    status: "latest",
  };
}

async function fetchLatestPackageVersion(packageName: string): Promise<string> {
  const response = await fetchJsonWithTimeout(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
  );

  if (response.status === 404) {
    throw new VersionNotFoundError(`${packageName} is not published on npm yet.`);
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
}

async function fetchLatestGitHubReleaseVersion(
  repository: string,
): Promise<string> {
  const response = await fetchJsonWithTimeout(
    `https://api.github.com/repos/${repository}/releases/latest`,
  );

  if (response.status === 404) {
    throw new VersionNotFoundError(
      `${repository} does not have a published GitHub release yet.`,
    );
  }

  if (!response.ok) {
    throw new Error("Unable to check GitHub releases for updates.");
  }

  const payload = (await response.json()) as {
    tag_name?: string;
    name?: string;
  };
  const version = normalizeVersion(payload.tag_name) ?? normalizeVersion(payload.name);
  if (!version) {
    throw new Error("GitHub release response did not include a version tag.");
  }
  return version;
}

async function fetchLatestGitHubTagVersion(repository: string): Promise<string> {
  const response = await fetchJsonWithTimeout(
    `https://api.github.com/repos/${repository}/tags?per_page=1`,
  );

  if (response.status === 404) {
    throw new VersionNotFoundError(
      `${repository} does not have any GitHub tags yet.`,
    );
  }

  if (!response.ok) {
    throw new Error("Unable to check GitHub tags for updates.");
  }

  const payload = (await response.json()) as Array<{
    name?: string;
  }>;
  const firstTag = payload[0];
  const version = normalizeVersion(firstTag?.name);
  if (!version) {
    throw new VersionNotFoundError(
      `${repository} did not return a version-like tag.`,
    );
  }
  return version;
}

async function fetchJsonWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, VERSION_CHECK_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out while checking for updates.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class VersionNotFoundError extends Error {}

function resolveLatestReleaseCandidate(
  candidates: VersionCandidate[],
): VersionCandidate | null {
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((currentLatest, candidate) => {
    const comparison = compareVersionStrings(candidate.version, currentLatest.version);
    if (comparison > 0) {
      return candidate;
    }
    return currentLatest;
  });
}

function compareVersionStrings(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  if (leftParts.length === 0 || rightParts.length === 0) {
    const lexical = left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (lexical > 0) {
      return 1;
    }
    if (lexical < 0) {
      return -1;
    }
    return 0;
  }
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
  const baseVersion = version
    .replace(/^v(?=\d)/i, "")
    .split(/[+-]/)[0] ?? "";
  return baseVersion
    .split(".")
    .map((segment) => {
      const match = segment.match(/\d+/);
      return match ? Number.parseInt(match[0], 10) : Number.NaN;
    })
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
