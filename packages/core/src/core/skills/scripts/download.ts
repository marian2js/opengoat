/**
 * Downloads GitHub repos as tarballs at pinned commit SHAs and extracts them.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface RepoEntry {
  name: string;
  url: string;
  sha: string;
}

const LOCK_FILE = ".vendor-lock.json";

/**
 * Returns true if the vendor directory already has the correct version downloaded.
 */
function isAlreadyDownloaded(vendorDir: string, repo: RepoEntry): boolean {
  const lockPath = path.join(vendorDir, repo.name, LOCK_FILE);
  if (!existsSync(lockPath)) return false;
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
    return lock.sha === repo.sha;
  } catch {
    return false;
  }
}

/**
 * Downloads and extracts a GitHub repo tarball to the vendor directory.
 * Skips download if already at the correct SHA.
 */
export function downloadRepo(vendorDir: string, repo: RepoEntry): string {
  const repoDir = path.join(vendorDir, repo.name);

  if (isAlreadyDownloaded(vendorDir, repo)) {
    return repoDir;
  }

  mkdirSync(vendorDir, { recursive: true });

  const tarballUrl = `${repo.url}/archive/${repo.sha}.tar.gz`;
  const tarPath = path.join(vendorDir, `${repo.name}.tar.gz`);

  // Download tarball
  execSync(`curl -sL "${tarballUrl}" -o "${tarPath}"`, { stdio: "pipe" });

  // Clean existing directory if present
  execSync(`rm -rf "${repoDir}"`, { stdio: "pipe" });
  mkdirSync(repoDir, { recursive: true });

  // Extract — GitHub tarballs have a top-level directory like repo-sha/
  execSync(`tar xzf "${tarPath}" -C "${repoDir}" --strip-components=1`, {
    stdio: "pipe",
  });

  // Clean up tarball
  execSync(`rm -f "${tarPath}"`, { stdio: "pipe" });

  // Write lock file for idempotency
  writeFileSync(lockPath(vendorDir, repo.name), JSON.stringify({ sha: repo.sha }));

  return repoDir;
}

function lockPath(vendorDir: string, repoName: string): string {
  return path.join(vendorDir, repoName, LOCK_FILE);
}

/**
 * Downloads all repos from the manifest.
 */
export function downloadAll(
  vendorDir: string,
  repos: RepoEntry[],
): Map<string, string> {
  const result = new Map<string, string>();
  for (const repo of repos) {
    const dir = downloadRepo(vendorDir, repo);
    result.set(repo.name, dir);
  }
  return result;
}
