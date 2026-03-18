/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENGOAT_BROWSER_SIDECAR_PASSWORD?: string;
  readonly VITE_OPENGOAT_BROWSER_SIDECAR_URL?: string;
  readonly VITE_OPENGOAT_BROWSER_SIDECAR_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
