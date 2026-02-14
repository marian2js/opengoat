import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  dependencies?: Record<string, string>;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("opengoat start runtime dependencies", () => {
  it("keeps CLI package dependencies aligned with UI server runtime imports", async () => {
    const uiServerAppPath = path.join(projectRoot, "packages", "ui", "src", "server", "app.ts");
    const cliPackagePath = path.join(projectRoot, "packages", "cli", "package.json");
    const uiPackagePath = path.join(projectRoot, "packages", "ui", "package.json");

    const [uiServerSource, cliPackageRaw, uiPackageRaw] = await Promise.all([
      readFile(uiServerAppPath, "utf-8"),
      readFile(cliPackagePath, "utf-8"),
      readFile(uiPackagePath, "utf-8"),
    ]);

    const cliPackage = JSON.parse(cliPackageRaw) as PackageManifest;
    const uiPackage = JSON.parse(uiPackageRaw) as PackageManifest;
    const cliDeps = cliPackage.dependencies ?? {};
    const uiDeps = uiPackage.dependencies ?? {};
    const runtimePackages = extractRuntimePackageImports(uiServerSource);

    expect(runtimePackages.length).toBeGreaterThan(0);

    for (const pkg of runtimePackages) {
      expect(cliDeps[pkg], `Missing dependency "${pkg}" in packages/cli/package.json`).toBeDefined();
      expect(cliDeps[pkg], `Dependency "${pkg}" range must match packages/ui/package.json`).toBe(uiDeps[pkg]);
    }
  });
});

function extractRuntimePackageImports(source: string): string[] {
  const imports = new Set<string>();
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
    const specifier = match[1];
    if (!specifier || specifier.startsWith("node:") || specifier.startsWith(".")) {
      continue;
    }

    const packageName = getPackageName(specifier);
    if (packageName === "@opengoat/core") {
      continue;
    }

    imports.add(packageName);
  }

  return [...imports].sort();
}

function getPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/", 3);
    return `${scope}/${name}`;
  }
  const [name] = specifier.split("/", 2);
  return name;
}
