/// <reference types="vite/client" />

type OpenGoatDesktopMenuAction =
  | "open-project"
  | "new-session"
  | "open-provider-settings"
  | "open-connection-settings";
type OpenGoatDesktopWindowMode = "workspace" | "onboarding";
type OpenGoatDesktopWindowChrome = {
  isMac: boolean;
  isMaximized: boolean;
  isFullScreen: boolean;
};

interface OpenGoatDesktopApi {
  onMenuAction: (listener: (action: OpenGoatDesktopMenuAction) => void) => () => void;
  setWindowMode: (mode: OpenGoatDesktopWindowMode) => void;
  onWindowChrome: (listener: (state: OpenGoatDesktopWindowChrome) => void) => () => void;
  getWindowChrome: () => Promise<OpenGoatDesktopWindowChrome>;
}

declare global {
  interface Window {
    opengoatDesktop?: OpenGoatDesktopApi;
  }
}

export {};
