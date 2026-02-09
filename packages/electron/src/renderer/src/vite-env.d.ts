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
type OpenGoatDesktopRunStatusEvent = {
  projectId: string;
  sessionId: string;
  stage:
    | "run_started"
    | "planner_started"
    | "planner_decision"
    | "delegation_started"
    | "provider_invocation_started"
    | "provider_invocation_completed"
    | "run_completed"
    | "remote_call_started"
    | "remote_call_completed";
  timestamp: string;
  runId?: string;
  step?: number;
  agentId?: string;
  targetAgentId?: string;
  providerId?: string;
  actionType?: string;
  mode?: string;
  code?: number;
  detail?: string;
};

interface OpenGoatDesktopApi {
  onMenuAction: (listener: (action: OpenGoatDesktopMenuAction) => void) => () => void;
  setWindowMode: (mode: OpenGoatDesktopWindowMode) => void;
  onWindowChrome: (listener: (state: OpenGoatDesktopWindowChrome) => void) => () => void;
  getWindowChrome: () => Promise<OpenGoatDesktopWindowChrome>;
  onRunStatus: (
    listener: (event: OpenGoatDesktopRunStatusEvent) => void
  ) => () => void;
}

declare global {
  interface Window {
    opengoatDesktop?: OpenGoatDesktopApi;
  }
}

export {};
