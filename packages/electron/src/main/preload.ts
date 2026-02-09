import { contextBridge, ipcRenderer } from "electron";
import { exposeElectronTRPC } from "electron-trpc/main";

const MENU_ACTION_CHANNEL = "opengoat:menu-action";
const WINDOW_MODE_CHANNEL = "opengoat:window-mode";
const WINDOW_CHROME_CHANNEL = "opengoat:window-chrome";
const WINDOW_CHROME_GET_CHANNEL = "opengoat:window-chrome:get";
const RUN_STATUS_CHANNEL = "opengoat:run-status";

type MenuAction =
  | "open-project"
  | "new-session"
  | "open-provider-settings"
  | "open-connection-settings";
type WindowMode = "workspace" | "onboarding";
type WindowChromeState = {
  isMac: boolean;
  isMaximized: boolean;
  isFullScreen: boolean;
};
type RunStatusEvent = {
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

process.once("loaded", () => {
  exposeElectronTRPC();
  contextBridge.exposeInMainWorld("opengoatDesktop", {
    onMenuAction: (listener: (action: MenuAction) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, action: MenuAction) => {
        listener(action);
      };

      ipcRenderer.on(MENU_ACTION_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(MENU_ACTION_CHANNEL, wrapped);
      };
    },
    setWindowMode: (mode: WindowMode) => {
      ipcRenderer.send(WINDOW_MODE_CHANNEL, mode);
    },
    onWindowChrome: (listener: (state: WindowChromeState) => void) => {
      const wrapped = (
        _event: Electron.IpcRendererEvent,
        state: WindowChromeState,
      ) => {
        listener(state);
      };

      ipcRenderer.on(WINDOW_CHROME_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(WINDOW_CHROME_CHANNEL, wrapped);
      };
    },
    getWindowChrome: async (): Promise<WindowChromeState> => {
      return ipcRenderer.invoke(WINDOW_CHROME_GET_CHANNEL);
    },
    onRunStatus: (listener: (event: RunStatusEvent) => void) => {
      const wrapped = (
        _event: Electron.IpcRendererEvent,
        event: RunStatusEvent,
      ) => {
        listener(event);
      };

      ipcRenderer.on(RUN_STATUS_CHANNEL, wrapped);
      return () => {
        ipcRenderer.removeListener(RUN_STATUS_CHANNEL, wrapped);
      };
    },
  });
});
