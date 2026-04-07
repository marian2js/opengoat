import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const versionFile = resolve(workspaceRoot, "VERSION");
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const jsonVersionFiles = [
  "package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
  "packages/contracts/package.json",
  "packages/core/package.json",
  "packages/sidecar/package.json",
  "packages/cli/package.json",
];

const cargoTomlFile = "Cargo.toml";
const cargoLockFile = "Cargo.lock";

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    check: false,
    set: null,
  };

  while (args.length > 0) {
    const arg = args.shift();

    if (arg === "--check") {
      options.check = true;
      continue;
    }

    if (arg === "--set") {
      const value = args.shift();
      if (!value) {
        throw new Error("Missing value for --set");
      }
      options.set = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function normalizeVersion(version) {
  const normalized = version.trim();

  if (!semverPattern.test(normalized)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  return normalized;
}

async function readJsonVersion(relativePath) {
  const absolutePath = resolve(workspaceRoot, relativePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  if (typeof parsed.version !== "string") {
    throw new Error(`${relativePath} does not contain a string version field`);
  }

  return parsed.version;
}

async function writeJsonVersion(relativePath, version) {
  const absolutePath = resolve(workspaceRoot, relativePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  parsed.version = version;
  await writeFile(absolutePath, `${JSON.stringify(parsed, null, 2)}\n`);
}

async function readCargoVersion() {
  const absolutePath = resolve(workspaceRoot, cargoTomlFile);
  const raw = await readFile(absolutePath, "utf8");
  const match = raw.match(
    /(\[workspace\.package\][\s\S]*?\r?\nversion = ")([^"]+)(")/,
  );

  if (!match) {
    throw new Error(
      `Could not locate [workspace.package] version in ${cargoTomlFile}`,
    );
  }

  return match[2];
}

async function writeCargoVersion(version) {
  const absolutePath = resolve(workspaceRoot, cargoTomlFile);
  const raw = await readFile(absolutePath, "utf8");
  const pattern = /(\[workspace\.package\][\s\S]*?\r?\nversion = ")([^"]+)(")/;
  const match = raw.match(pattern);

  if (!match) {
    throw new Error(
      `Could not locate [workspace.package] version in ${cargoTomlFile}`,
    );
  }

  const updated = raw.replace(pattern, `$1${version}$3`);
  await writeFile(absolutePath, updated);
}

async function readCargoLockVersion() {
  const absolutePath = resolve(workspaceRoot, cargoLockFile);
  const raw = await readFile(absolutePath, "utf8");
  const match = raw.match(
    /(\[\[package\]\]\r?\nname = "opengoat-desktop"\r?\nversion = ")([^"]+)(")/,
  );

  if (!match) {
    throw new Error(
      `Could not locate opengoat-desktop version in ${cargoLockFile}`,
    );
  }

  return match[2];
}

async function writeCargoLockVersion(version) {
  const absolutePath = resolve(workspaceRoot, cargoLockFile);
  const raw = await readFile(absolutePath, "utf8");
  const pattern =
    /(\[\[package\]\]\r?\nname = "opengoat-desktop"\r?\nversion = ")([^"]+)(")/;
  const match = raw.match(pattern);

  if (!match) {
    throw new Error(
      `Could not locate opengoat-desktop version in ${cargoLockFile}`,
    );
  }

  const updated = raw.replace(pattern, `$1${version}$3`);
  await writeFile(absolutePath, updated);
}

async function collectVersions() {
  const versions = new Map();
  const canonicalVersion = normalizeVersion(
    await readFile(versionFile, "utf8"),
  );
  versions.set("VERSION", canonicalVersion);

  for (const relativePath of jsonVersionFiles) {
    versions.set(relativePath, await readJsonVersion(relativePath));
  }

  versions.set(cargoTomlFile, await readCargoVersion());
  versions.set(cargoLockFile, await readCargoLockVersion());
  return { canonicalVersion, versions };
}

async function checkVersions(expectedVersion) {
  const { versions } = await collectVersions();
  const mismatches = [...versions.entries()].filter(
    ([, actualVersion]) => actualVersion !== expectedVersion,
  );

  if (mismatches.length === 0) {
    console.log(`Versions are synchronized at ${expectedVersion}`);
    return;
  }

  for (const [file, actualVersion] of mismatches) {
    console.error(
      `${file}: expected ${expectedVersion}, found ${actualVersion}`,
    );
  }

  process.exitCode = 1;
}

async function syncVersions(version) {
  await writeFile(versionFile, `${version}\n`);

  await Promise.all(
    jsonVersionFiles.map((relativePath) =>
      writeJsonVersion(relativePath, version),
    ),
  );
  await writeCargoVersion(version);
  await writeCargoLockVersion(version);

  console.log(`Synchronized release version to ${version}`);
}

const options = parseArgs(process.argv.slice(2));
const desiredVersion = options.set
  ? normalizeVersion(options.set)
  : normalizeVersion(await readFile(versionFile, "utf8"));

if (options.check) {
  await checkVersions(desiredVersion);
} else {
  await syncVersions(desiredVersion);
}
