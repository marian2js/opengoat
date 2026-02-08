/// <reference types="vite/client" />

type OpenGoatDesktopMenuAction =
  | "open-project"
  | "new-session"
  | "open-provider-settings"
  | "open-connection-settings";

interface OpenGoatDesktopApi {
  onMenuAction: (listener: (action: OpenGoatDesktopMenuAction) => void) => () => void;
}

declare global {
  interface Window {
    opengoatDesktop?: OpenGoatDesktopApi;
  }
}

export {};
