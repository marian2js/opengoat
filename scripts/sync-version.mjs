import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const versionFile = resolve(workspaceRoot, "VERSION");
const tauriConfigFile = "apps/desktop/src-tauri/tauri.conf.json";
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const jsonVersionFiles = [
  "package.json",
  "apps/desktop/package.json",
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

function deriveWindowsMsiVersion(version) {
  const semverMatch = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );

  if (!semverMatch) {
    throw new Error(`Cannot derive Windows MSI version from ${version}`);
  }

  const major = Number(semverMatch[1]);
  const minor = Number(semverMatch[2]);
  const patch = Number(semverMatch[3]);
  const prerelease = semverMatch[4];

  if (major <= 255 && minor <= 255 && patch <= 65535) {
    if (!prerelease) {
      return `${major}.${minor}.${patch}`;
    }

    if (/^\d+$/.test(prerelease)) {
      const build = Number(prerelease);
      if (build <= 65535) {
        return `${major}.${minor}.${patch}.${build}`;
      }
    }
  }

  const calverMatch = version.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-(\d+))?$/);
  if (!calverMatch) {
    throw new Error(
      `Cannot derive a Windows-safe MSI version from ${version}; set a version with major/minor <= 255 or use OpenGoat CalVer.`,
    );
  }

  const calverYear = Number(calverMatch[1]) % 100;
  const calverMonth = Number(calverMatch[2]);
  const calverDay = Number(calverMatch[3]);
  const calverBuild = Number(calverMatch[4] ?? 0);
  if (
    calverMonth > 255 ||
    calverDay > 65535 ||
    calverBuild > 65535
  ) {
    throw new Error(`Derived Windows MSI version is out of range for ${version}`);
  }

  return `${calverYear}.${calverMonth}.${calverDay}.${calverBuild}`;
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

async function readTauriConfigVersions() {
  const absolutePath = resolve(workspaceRoot, tauriConfigFile);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  const tauriVersion = parsed.version;
  const windowsMsiVersion = parsed.bundle?.windows?.wix?.version;

  if (typeof tauriVersion !== "string") {
    throw new Error(`${tauriConfigFile} does not contain a string version field`);
  }
  if (typeof windowsMsiVersion !== "string") {
    throw new Error(
      `${tauriConfigFile} does not contain bundle.windows.wix.version`,
    );
  }

  return { tauriVersion, windowsMsiVersion };
}

async function writeTauriConfigVersion(version) {
  const absolutePath = resolve(workspaceRoot, tauriConfigFile);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  parsed.version = version;
  parsed.bundle ??= {};
  parsed.bundle.windows ??= {};
  parsed.bundle.windows.wix ??= {};
  parsed.bundle.windows.wix.version = deriveWindowsMsiVersion(version);

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

  const tauriVersions = await readTauriConfigVersions();
  versions.set(tauriConfigFile, tauriVersions.tauriVersion);
  versions.set(
    `${tauriConfigFile}#bundle.windows.wix.version`,
    tauriVersions.windowsMsiVersion,
  );

  versions.set(cargoTomlFile, await readCargoVersion());
  versions.set(cargoLockFile, await readCargoLockVersion());
  return { canonicalVersion, versions };
}

async function checkVersions(expectedVersion) {
  const { versions } = await collectVersions();
  const expectedVersions = new Map(
    [...versions.keys()].map((key) => [key, expectedVersion]),
  );
  expectedVersions.set(
    `${tauriConfigFile}#bundle.windows.wix.version`,
    deriveWindowsMsiVersion(expectedVersion),
  );

  const mismatches = [...versions.entries()].filter(([file, actualVersion]) => {
    return actualVersion !== expectedVersions.get(file);
  });

  if (mismatches.length === 0) {
    console.log(`Versions are synchronized at ${expectedVersion}`);
    return;
  }

  for (const [file, actualVersion] of mismatches) {
    console.error(
      `${file}: expected ${expectedVersions.get(file)}, found ${actualVersion}`,
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
  await writeTauriConfigVersion(version);
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
