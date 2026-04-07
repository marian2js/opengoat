import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const CWD = process.cwd();
const CHANGESET_DIR = join(CWD, ".changeset");
const VERSION_PATH = join(CWD, "VERSION");
const ROOT_PACKAGE_JSON_PATH = join(CWD, "package.json");
const DESKTOP_PACKAGE_JSON_PATH = join(CWD, "apps", "desktop", "package.json");
const SIDECAR_PACKAGE_JSON_PATH = join(CWD, "packages", "sidecar", "package.json");
const CLI_PACKAGE_JSON_PATH = join(CWD, "packages", "cli", "package.json");
const CORE_PACKAGE_JSON_PATH = join(CWD, "packages", "core", "package.json");
const CONTRACTS_PACKAGE_JSON_PATH = join(CWD, "packages", "contracts", "package.json");
const TAURI_CONFIG_PATH = join(
  CWD,
  "apps",
  "desktop",
  "src-tauri",
  "tauri.conf.json",
);
const CARGO_TOML_PATH = join(CWD, "Cargo.toml");
const CARGO_LOCK_PATH = join(CWD, "Cargo.lock");
const CHANGELOG_PATH = join(CWD, "CHANGELOG.md");

function run() {
  // 1. Check for changesets
  const files = readdirSync(CHANGESET_DIR).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );
  if (files.length === 0) {
    console.log("No changesets found.");
    return; // Exit normally, CI handles "no update" case
  }

  // 2. Determine target version
  const rootPkg = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, "utf8"));
  const desktopPkg = JSON.parse(readFileSync(DESKTOP_PACKAGE_JSON_PATH, "utf8"));
  const sidecarPkg = JSON.parse(readFileSync(SIDECAR_PACKAGE_JSON_PATH, "utf8"));
  const cliPkg = JSON.parse(readFileSync(CLI_PACKAGE_JSON_PATH, "utf8"));
  const corePkg = JSON.parse(readFileSync(CORE_PACKAGE_JSON_PATH, "utf8"));
  const contractsPkg = JSON.parse(readFileSync(CONTRACTS_PACKAGE_JSON_PATH, "utf8"));
  const tauriConfig = JSON.parse(readFileSync(TAURI_CONFIG_PATH, "utf8"));

  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const todayVer = `${year}.${month}.${day}`;
  let nextVer = todayVer;
  const parsedCurrent = parseCalVer(cliPkg.version);
  if (parsedCurrent) {
    const currentDateStamp = dateStamp(parsedCurrent.year, parsedCurrent.month, parsedCurrent.day);
    const todayDateStamp = dateStamp(year, month, day);
    if (currentDateStamp > todayDateStamp) {
      nextVer = toCalVer(parsedCurrent, (parsedCurrent.suffix ?? 1) + 1);
    } else if (
      parsedCurrent.year === year &&
      parsedCurrent.month === month &&
      parsedCurrent.day === day
    ) {
      nextVer = `${todayVer}-${(parsedCurrent.suffix ?? 1) + 1}`;
    }
  }

  console.log(
    `Bumping versions: cli=${cliPkg.version}, core=${corePkg.version} -> ${nextVer}`,
  );

  // 3. Aggregate Changelog
  let changelogEntry = `## ${nextVer}\n\n`;
  for (const file of files) {
    const content = readFileSync(join(CHANGESET_DIR, file), "utf8");
    // Simple parsing: extract content after ---
    const parts = content.split("---");
    if (parts.length >= 3) {
      const body = parts.slice(2).join("---").trim();
      changelogEntry += `- ${body}\n`;
    }
  }
  changelogEntry += "\n";

  // 4. Update files
  // Update package.json
  rootPkg.version = nextVer;
  desktopPkg.version = nextVer;
  sidecarPkg.version = nextVer;
  cliPkg.version = nextVer;
  corePkg.version = nextVer;
  contractsPkg.version = nextVer;
  tauriConfig.version = nextVer;

  writeFileSync(VERSION_PATH, `${nextVer}\n`);
  writeFileSync(ROOT_PACKAGE_JSON_PATH, JSON.stringify(rootPkg, null, 2) + "\n");
  writeFileSync(
    DESKTOP_PACKAGE_JSON_PATH,
    JSON.stringify(desktopPkg, null, 2) + "\n",
  );
  writeFileSync(
    SIDECAR_PACKAGE_JSON_PATH,
    JSON.stringify(sidecarPkg, null, 2) + "\n",
  );
  writeFileSync(CLI_PACKAGE_JSON_PATH, JSON.stringify(cliPkg, null, 2) + "\n");
  writeFileSync(
    CORE_PACKAGE_JSON_PATH,
    JSON.stringify(corePkg, null, 2) + "\n",
  );
  writeFileSync(
    CONTRACTS_PACKAGE_JSON_PATH,
    JSON.stringify(contractsPkg, null, 2) + "\n",
  );
  writeFileSync(TAURI_CONFIG_PATH, JSON.stringify(tauriConfig, null, 2) + "\n");
  writeFileSync(
    CARGO_TOML_PATH,
    readFileSync(CARGO_TOML_PATH, "utf8").replace(
      /(\[workspace\.package\][\s\S]*?\r?\nversion = ")([^"]+)(")/,
      `$1${nextVer}$3`,
    ),
  );
  writeFileSync(
    CARGO_LOCK_PATH,
    readFileSync(CARGO_LOCK_PATH, "utf8").replace(
      /(\[\[package\]\]\r?\nname = "opengoat-desktop"\r?\nversion = ")([^"]+)(")/,
      `$1${nextVer}$3`,
    ),
  );

  // Update CHANGELOG.md
  const currentLog = existsSync(CHANGELOG_PATH)
    ? readFileSync(CHANGELOG_PATH, "utf8")
    : "# Changelog\n\n";
  // Insert after header if exists, or append
  const newLog = currentLog.replace(
    "# Changelog\n\n",
    `# Changelog\n\n${changelogEntry}`,
  );
  // fallback if no header
  const finalLog =
    newLog === currentLog
      ? `# Changelog\n\n${changelogEntry}${currentLog.replace(
          "# Changelog\n\n",
          "",
        )}`
      : newLog;

  writeFileSync(CHANGELOG_PATH, finalLog);

  // 5. Delete changesets
  for (const file of files) {
    unlinkSync(join(CHANGESET_DIR, file));
  }

  console.log(`Version ${nextVer} applied and changesets consumed.`);
}

function parseCalVer(version) {
  if (typeof version !== "string") {
    return undefined;
  }
  const match = version.trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-(\d+))?$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const suffix = match[4] ? Number(match[4]) : undefined;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }
  if (suffix !== undefined && (!Number.isInteger(suffix) || suffix < 2)) {
    return undefined;
  }
  return { year, month, day, suffix };
}

function dateStamp(year, month, day) {
  return year * 10000 + month * 100 + day;
}

function toCalVer(parts, suffix) {
  const base = `${parts.year}.${parts.month}.${parts.day}`;
  return suffix ? `${base}-${suffix}` : base;
}

run();
