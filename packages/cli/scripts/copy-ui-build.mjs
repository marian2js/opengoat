import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliPackageRoot = path.resolve(scriptDir, "..");
const uiPackageRoot = path.resolve(cliPackageRoot, "..", "ui");
const sourceUiDist = path.resolve(uiPackageRoot, "dist");
const targetUiRoot = path.resolve(cliPackageRoot, "dist", "ui");
const targetUiDist = path.resolve(targetUiRoot, "dist");

if (!existsSync(sourceUiDist)) {
  throw new Error(
    `UI build output not found at ${sourceUiDist}. Run "pnpm --filter @opengoat/ui build" before building CLI.`,
  );
}

rmSync(targetUiRoot, { recursive: true, force: true });
mkdirSync(targetUiRoot, { recursive: true });
cpSync(sourceUiDist, targetUiDist, { recursive: true });
