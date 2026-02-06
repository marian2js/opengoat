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
const PACKAGE_JSON_PATH = join(CWD, "package.json");
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
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const todayVer = getCalVer();
  let nextVer = todayVer;

  if (pkg.version === todayVer) {
    // If released today already, add patch: 2026.2.7 -> 2026.2.7.1
    nextVer = `${todayVer}.1`;
  } else if (pkg.version.startsWith(todayVer + ".")) {
    // already has patch, increment it
    const parts = pkg.version.split(".");
    const patch = parseInt(parts[3] || "0", 10) + 1;
    nextVer = `${todayVer}.${patch}`;
  }

  console.log(`Bumping version: ${pkg.version} -> ${nextVer}`);

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
  pkg.version = nextVer;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + "\n");

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
