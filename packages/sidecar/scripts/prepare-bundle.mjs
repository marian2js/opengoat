import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const workspaceRoot = resolve(packageDir, "../..");
const bundleDir = resolve(packageDir, ".bundle");
const bundledNodePath = join(bundleDir, "node", "bin", "node");

async function run(command, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(" ")} failed with code=${String(code)} signal=${String(signal)}`,
        ),
      );
    });
  });
}

await rm(bundleDir, { force: true, recursive: true });
await run(
  "pnpm",
  ["deploy", "--legacy", "--filter", "@opengoat/sidecar", "--prod", bundleDir],
  workspaceRoot,
);
await mkdir(dirname(bundledNodePath), { recursive: true });
await cp(process.execPath, bundledNodePath);
await chmod(bundledNodePath, 0o755);
