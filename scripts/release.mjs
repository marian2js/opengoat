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
const CLI_PACKAGE_JSON_PATH = join(CWD, "packages", "cli", "package.json");
const CORE_PACKAGE_JSON_PATH = join(CWD, "packages", "core", "package.json");
const CHANGELOG_PATH = join(CWD, "CHANGELOG.md");

function getCalVer() {
  const date = new Date();
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}.${m}.${d}`;
}

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
  const cliPkg = JSON.parse(readFileSync(CLI_PACKAGE_JSON_PATH, "utf8"));
  const corePkg = JSON.parse(readFileSync(CORE_PACKAGE_JSON_PATH, "utf8"));

  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const todayVer = `${year}.${month}.${day}`;

  let nextVer = todayVer;

  // Check if we need to bump the patch beyond today's date
  if (cliPkg.version) {
    const [pkgMajor, pkgMinor, pkgPatch] = cliPkg.version
      .split(".")
      .map(Number);

    // If we are in the same Year.Month
    if (pkgMajor === year && pkgMinor === month) {
      if (pkgPatch >= day) {
        // If the package is already at today's "day" or ahead (due to multiple releases),
        // we just increment the patch.
        nextVer = `${year}.${month}.${pkgPatch + 1}`;
      }
      // Else: pkgPatch < day, so we jump correctly to todayVer (e.g. 13 -> 14)
    }
    // Else: Different month/year, reset to todayVer
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
  cliPkg.version = nextVer;
  corePkg.version = nextVer;
  writeFileSync(CLI_PACKAGE_JSON_PATH, JSON.stringify(cliPkg, null, 2) + "\n");
  writeFileSync(
    CORE_PACKAGE_JSON_PATH,
    JSON.stringify(corePkg, null, 2) + "\n",
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

run();
