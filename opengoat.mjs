#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const entrypoint = resolve(currentDir, "packages/cli/dist/index.js");

if (!existsSync(entrypoint)) {
  console.error("OpenGoat CLI is not built yet. Run: pnpm build");
  process.exit(1);
}

await import(entrypoint);
