#!/usr/bin/env node
/**
 * Skill vendoring pipeline — downloads, normalizes, wraps, and maps
 * marketing skills and agency-agent personas for OpenGoat.
 *
 * Usage: pnpm run vendor-skills
 */

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCredits, type CreditInfo } from "./credits.js";
import { downloadAll, type RepoEntry } from "./download.js";
import { mapContext } from "./map-context.js";
import { normalizeMarketing } from "./normalize-marketing.js";
import { normalizePersona, PERSONA_SOURCE_MAP } from "./normalize-personas.js";
import { wrapSkill } from "./wrap.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SKILLS_DIR = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(SKILLS_DIR, "vendor-manifest.json");
const PROJECT_ROOT = path.resolve(SKILLS_DIR, "../../../../..");
const VENDOR_DIR = path.join(PROJECT_ROOT, "vendor");
const BUNDLED_DIR = path.join(SKILLS_DIR, "bundled");
const MARKETING_OUT = path.join(BUNDLED_DIR, "marketing");
const PERSONAS_OUT = path.join(BUNDLED_DIR, "personas");

function readManifest(): RepoEntry[] {
  const content = readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(content);
  return manifest.repos as RepoEntry[];
}

function cleanOutputDirs(): void {
  if (existsSync(MARKETING_OUT)) rmSync(MARKETING_OUT, { recursive: true });
  if (existsSync(PERSONAS_OUT)) rmSync(PERSONAS_OUT, { recursive: true });
  mkdirSync(MARKETING_OUT, { recursive: true });
  mkdirSync(PERSONAS_OUT, { recursive: true });
}

function processMarketingSkills(
  marketingDir: string,
  repoInfo: RepoEntry,
): void {
  // Skills are inside a skills/ subdirectory in the marketingskills repo
  const skillsSubdir = path.join(marketingDir, "skills");
  const baseDir = existsSync(skillsSubdir) ? skillsSubdir : marketingDir;
  const entries = readdirSync(baseDir);

  let skillCount = 0;
  for (const entry of entries) {
    const entryPath = path.join(baseDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    const skillFile = path.join(entryPath, "SKILL.md");
    if (!existsSync(skillFile)) continue;

    // Read, normalize, wrap, map
    let content = readFileSync(skillFile, "utf-8");
    content = normalizeMarketing(content);
    content = wrapSkill(content);
    content = mapContext(content);

    // Write output
    const outDir = path.join(MARKETING_OUT, entry);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "SKILL.md"), content);

    // Copy references/ subdirectory if present
    const refsDir = path.join(entryPath, "references");
    if (existsSync(refsDir) && statSync(refsDir).isDirectory()) {
      const outRefsDir = path.join(outDir, "references");
      cpSync(refsDir, outRefsDir, { recursive: true });
    }

    skillCount++;
  }

  console.log(`  Processed ${skillCount} marketing skills`);

  // Copy LICENSE and generate CREDITS.md
  copyLicenseAndCredits(marketingDir, MARKETING_OUT, repoInfo);
}

function processPersonas(agencyDir: string, repoInfo: RepoEntry): void {
  let personaCount = 0;

  for (const [sourcePath, slug] of Object.entries(PERSONA_SOURCE_MAP)) {
    const fullPath = path.join(agencyDir, sourcePath);
    if (!existsSync(fullPath)) {
      console.warn(`  Warning: persona source not found: ${sourcePath}`);
      continue;
    }

    let content = readFileSync(fullPath, "utf-8");
    content = normalizePersona(content, slug);
    content = wrapSkill(content);

    const outDir = path.join(PERSONAS_OUT, slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "SKILL.md"), content);

    personaCount++;
  }

  console.log(`  Processed ${personaCount} personas`);

  // Copy LICENSE and generate CREDITS.md
  copyLicenseAndCredits(agencyDir, PERSONAS_OUT, repoInfo);
}

function copyLicenseAndCredits(
  sourceDir: string,
  outputDir: string,
  repoInfo: RepoEntry,
): void {
  // Copy LICENSE file
  const licenseFile = findLicenseFile(sourceDir);
  if (licenseFile) {
    cpSync(licenseFile, path.join(outputDir, "LICENSE"));
  }

  // Generate CREDITS.md
  const creditInfo: CreditInfo = {
    repoName: repoInfo.name,
    repoUrl: repoInfo.url,
    commitSha: repoInfo.sha,
    license: "MIT",
  };
  writeFileSync(path.join(outputDir, "CREDITS.md"), generateCredits(creditInfo));
}

function findLicenseFile(dir: string): string | null {
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE"];
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function main(): void {
  console.log("OpenGoat Skill Vendoring Pipeline");
  console.log("=================================\n");

  // Step 1: Read manifest
  const repos = readManifest();
  console.log(`Manifest: ${repos.length} repos pinned`);

  // Step 2: Download repos
  console.log("\nStep 1: Downloading repos...");
  const repoDirs = downloadAll(VENDOR_DIR, repos);

  const marketingDir = repoDirs.get("marketingskills");
  const agencyDir = repoDirs.get("agency-agents");

  if (!marketingDir || !agencyDir) {
    throw new Error("Failed to download one or more repos");
  }

  // Step 3: Clean output directories
  console.log("\nStep 2: Cleaning output directories...");
  cleanOutputDirs();

  // Step 4: Process marketing skills
  console.log("\nStep 3: Processing marketing skills...");
  const marketingRepo = repos.find((r) => r.name === "marketingskills")!;
  processMarketingSkills(marketingDir, marketingRepo);

  // Step 5: Process personas
  console.log("\nStep 4: Processing personas...");
  const agencyRepo = repos.find((r) => r.name === "agency-agents")!;
  processPersonas(agencyDir, agencyRepo);

  console.log("\nDone! Bundled skills written to:");
  console.log(`  ${MARKETING_OUT}`);
  console.log(`  ${PERSONAS_OUT}`);
}

main();
