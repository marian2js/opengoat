import { contextBridge, ipcRenderer } from "electron";
import { exposeElectronTRPC } from "electron-trpc/main";

const MENU_ACTION_CHANNEL = "opengoat:menu-action";
const WINDOW_MODE_CHANNEL = "opengoat:window-mode";
const WINDOW_CHROME_CHANNEL = "opengoat:window-chrome";
const WINDOW_CHROME_GET_CHANNEL = "opengoat:window-chrome:get";

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
  });
});
