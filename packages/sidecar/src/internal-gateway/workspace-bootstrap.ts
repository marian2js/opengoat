import { access, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const LEGACY_OPENGOAT_MARKERS = [
  "OpenGoat Main",
  "OpenGoat Workspace",
  "Primary OpenGoat finance orchestration agent.",
  "a OpenGoat agent",
  "Product: OpenGoat",
] as const;

function stripFrontMatter(content: string): string {
  if (!content.startsWith("---")) {
    return content;
  }

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return content;
  }

  return content.slice(endIndex + "\n---".length).replace(/^\s+/, "");
}

export async function loadPackagedTemplate(name: string): Promise<string> {
  const entry = require.resolve("openclaw");
  const packageRoot = dirname(dirname(entry));
  const templatePath = join(packageRoot, "docs", "reference", "templates", name);
  return stripFrontMatter(await readFile(templatePath, "utf8"));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function containsLegacyOpenGoatPersona(content: string): boolean {
  return LEGACY_OPENGOAT_MARKERS.some((marker) => content.includes(marker));
}

export async function migrateLegacyDefaultWorkspacePersona(
  workspaceDir: string,
): Promise<boolean> {
  const soulPath = join(workspaceDir, "SOUL.md");
  const identityPath = join(workspaceDir, "IDENTITY.md");
  const userPath = join(workspaceDir, "USER.md");
  const bootstrapPath = join(workspaceDir, "BOOTSTRAP.md");

  const [soulExists, identityExists, userExists] = await Promise.all([
    fileExists(soulPath),
    fileExists(identityPath),
    fileExists(userPath),
  ]);

  const files = await Promise.all([
    soulExists ? readFile(soulPath, "utf8") : Promise.resolve(""),
    identityExists ? readFile(identityPath, "utf8") : Promise.resolve(""),
    userExists ? readFile(userPath, "utf8") : Promise.resolve(""),
  ]);

  const shouldReset =
    files.some((content) => content && containsLegacyOpenGoatPersona(content));

  if (!shouldReset) {
    return false;
  }

  const [soulTemplate, identityTemplate, userTemplate, bootstrapTemplate] =
    await Promise.all([
      loadPackagedTemplate("SOUL.md"),
      loadPackagedTemplate("IDENTITY.md"),
      loadPackagedTemplate("USER.md"),
      loadPackagedTemplate("BOOTSTRAP.md"),
    ]);

  await Promise.all([
    writeFile(soulPath, soulTemplate, "utf8"),
    writeFile(identityPath, identityTemplate, "utf8"),
    writeFile(userPath, userTemplate, "utf8"),
    fileExists(bootstrapPath).then((exists) =>
      exists ? Promise.resolve() : writeFile(bootstrapPath, bootstrapTemplate, "utf8"),
    ),
  ]);

  return true;
}
