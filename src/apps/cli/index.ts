#!/usr/bin/env node
import { runCli } from "./cli.js";
import { loadDotEnv } from "../../platform/node/dotenv.js";

try {
  await loadDotEnv();
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`OpenGoat CLI error: ${message}\n`);
  process.exitCode = 1;
}
