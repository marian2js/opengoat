import { contextBridge, ipcRenderer } from "electron";
import { exposeElectronTRPC } from "electron-trpc/main";

const MENU_ACTION_CHANNEL = "opengoat:menu-action";
const WINDOW_MODE_CHANNEL = "opengoat:window-mode";

type MenuAction =
  | "open-project"
  | "new-session"
  | "open-provider-settings"
  | "open-connection-settings";
type WindowMode = "workspace" | "onboarding";

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
  });
});
