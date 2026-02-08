/// <reference types="vite/client" />

type OpenGoatDesktopMenuAction =
  | "open-project"
  | "new-session"
  | "open-provider-settings"
  | "open-connection-settings";
type OpenGoatDesktopWindowMode = "workspace" | "onboarding";

interface OpenGoatDesktopApi {
  onMenuAction: (listener: (action: OpenGoatDesktopMenuAction) => void) => () => void;
  setWindowMode: (mode: OpenGoatDesktopWindowMode) => void;
}

declare global {
  interface Window {
    opengoatDesktop?: OpenGoatDesktopApi;
  }
}

export {};
