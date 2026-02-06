#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const entrypoint = resolve(currentDir, "dist/apps/cli/index.js");

if (!existsSync(entrypoint)) {
  console.error("OpenGoat is not built yet. Run: npm run build");
  process.exit(1);
}

await import(entrypoint);
