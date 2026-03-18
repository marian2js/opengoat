import { sidecarConnectionSchema, type SidecarConnection } from "@opengoat/contracts";

const DEV_DEFAULT_SIDECAR_URL = "";
const DEV_DEFAULT_USERNAME = "opengoat";
const DEV_DEFAULT_PASSWORD = "opengoat-dev-password";

type InitStep = "sidecar_waiting" | "sidecar_ready" | "done";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

interface BrowserDevEnv {
  DEV: boolean;
  VITE_OPENGOAT_BROWSER_SIDECAR_PASSWORD?: string;
  VITE_OPENGOAT_BROWSER_SIDECAR_URL?: string;
  VITE_OPENGOAT_BROWSER_SIDECAR_USERNAME?: string;
}

export function resolveBrowserDevConnection(
  env: BrowserDevEnv,
  tauriRuntime: boolean,
): SidecarConnection | null {
  if (!env.DEV || tauriRuntime) {
    return null;
  }

  const url = env.VITE_OPENGOAT_BROWSER_SIDECAR_URL?.trim();
  const username = env.VITE_OPENGOAT_BROWSER_SIDECAR_USERNAME?.trim();
  const password = env.VITE_OPENGOAT_BROWSER_SIDECAR_PASSWORD?.trim();

  const connection = {
    isSidecar: true,
    password: password && password.length > 0 ? password : DEV_DEFAULT_PASSWORD,
    url:
      url && url.length > 0
        ? url
        : DEV_DEFAULT_SIDECAR_URL ||
          (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:1510"),
    username: username && username.length > 0 ? username : DEV_DEFAULT_USERNAME,
  };

  return sidecarConnectionSchema.parse(connection);
}

function readBrowserDevConnection(): SidecarConnection | null {
  return resolveBrowserDevConnection(import.meta.env, isTauriRuntime());
}

async function awaitTauriConnection(): Promise<SidecarConnection> {
  const [{ Channel, invoke }] = await Promise.all([import("@tauri-apps/api/core")]);

  return sidecarConnectionSchema.parse(
    await invoke<SidecarConnection>("await_initialization", {
      events: new Channel<InitStep>(),
    }),
  );
}

export async function initializeSidecarConnection(): Promise<SidecarConnection> {
  const browserConnection = readBrowserDevConnection();
  if (browserConnection) {
    return browserConnection;
  }

  return await awaitTauriConnection();
}
