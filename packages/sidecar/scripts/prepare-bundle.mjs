import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const workspaceRoot = resolve(packageDir, "../..");
const bundleDir = resolve(packageDir, ".bundle");
const packageManagerExecPath = process.env.npm_execpath;
const pnpmHome = process.env.PNPM_HOME;
const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const bundledNodePath = join(
  bundleDir,
  "node",
  "bin",
  process.platform === "win32" ? "node.exe" : "node",
);

async function run(command, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", (error) => {
      rejectPromise(error);
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

async function runPnpm(args, cwd) {
  if (packageManagerExecPath && /\.(c?js|mjs)$/i.test(packageManagerExecPath)) {
    await run(process.execPath, [packageManagerExecPath, ...args], cwd);
    return;
  }

  const packageManagerCommand = pnpmHome
    ? join(pnpmHome, pnpmExecutable)
    : pnpmExecutable;
  await run(packageManagerCommand, args, cwd);
}

await rm(bundleDir, { force: true, recursive: true });
await runPnpm(
  [
    "deploy",
    "--legacy",
    "--filter",
    "@opengoat/sidecar",
    "--prod",
    "--config.node-linker=hoisted",
    bundleDir,
  ],
  workspaceRoot,
);
await mkdir(dirname(bundledNodePath), { recursive: true });
await cp(process.execPath, bundledNodePath);
if (process.platform !== "win32") {
  await chmod(bundledNodePath, 0o755);
}
