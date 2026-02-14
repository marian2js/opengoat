import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliPackageRoot = path.resolve(scriptDir, "..");
const pluginPackageRoot = path.resolve(cliPackageRoot, "..", "openclaw-plugin");
const targetPluginRoot = path.resolve(cliPackageRoot, "dist", "openclaw-plugin");

if (!existsSync(pluginPackageRoot)) {
  throw new Error(`OpenClaw plugin source not found at ${pluginPackageRoot}.`);
}

rmSync(targetPluginRoot, { recursive: true, force: true });
mkdirSync(targetPluginRoot, { recursive: true });

for (const entryName of ["index.ts", "openclaw.plugin.json", "package.json", "src"]) {
  const sourcePath = path.resolve(pluginPackageRoot, entryName);
  if (!existsSync(sourcePath)) {
    throw new Error(`OpenClaw plugin artifact missing: ${sourcePath}`);
  }
  const targetPath = path.resolve(targetPluginRoot, entryName);
  cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (source) => !source.endsWith(".test.ts"),
  });
}
