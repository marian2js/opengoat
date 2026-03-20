import { spawn } from "node:child_process";

const hostname = process.env.OPENGOAT_DEV_SIDECAR_HOSTNAME || "127.0.0.1";
const port = process.env.OPENGOAT_DEV_SIDECAR_PORT || "19749";
const username = process.env.OPENGOAT_DEV_SIDECAR_USERNAME || "opengoat";
const password =
  process.env.OPENGOAT_DEV_SIDECAR_PASSWORD || "opengoat-dev-password";
const appPort = process.env.OPENGOAT_DEV_APP_PORT || "1430";

const sharedEnv = {
  ...process.env,
  OPENGOAT_SERVER_HOSTNAME: hostname,
  OPENGOAT_SERVER_PASSWORD: password,
  OPENGOAT_SERVER_PORT: port,
  OPENGOAT_SERVER_USERNAME: username,
  VITE_OPENGOAT_BROWSER_SIDECAR_PASSWORD: password,
  VITE_OPENGOAT_BROWSER_SIDECAR_USERNAME: username,
};

const children = [];
let isShuttingDown = false;

function spawnPnpm(args) {
  const child = spawn("pnpm", args, {
    cwd: process.cwd(),
    env: sharedEnv,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    for (const current of children) {
      if (current !== child && !current.killed) {
        current.kill("SIGTERM");
      }
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  children.push(child);
  return child;
}

function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

spawnPnpm(["sidecar:dev"]);
spawnPnpm([
  "--filter",
  "@opengoat/desktop",
  "exec",
  "vite",
  "--host",
  "127.0.0.1",
  "--port",
  appPort,
  "--strictPort",
]);
