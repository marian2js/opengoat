import { createDesktopRouter } from "@main/ipc/router";
import { WorkbenchService } from "@main/state/workbench-service";
import { WorkbenchStore } from "@main/state/workbench-store";
import { createOpenGoatRuntime } from "@opengoat/core";
import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import { createIPCHandler } from "electron-trpc/main";
import path from "node:path";

if (started) {
  app.quit();
}

const runtime = createOpenGoatRuntime({
  logLevel: process.env.OPENGOAT_LOG_LEVEL === "debug" ? "debug" : "info",
  logFormat: process.env.OPENGOAT_LOG_FORMAT === "json" ? "json" : "pretty",
});

const workbenchStore = new WorkbenchStore({
  stateFilePath: path.join(
    runtime.service.getHomeDir(),
    "apps",
    "desktop",
    "state.json",
  ),
});
const workbenchService = new WorkbenchService({
  opengoat: runtime.service,
  store: workbenchStore,
});

const router = createDesktopRouter(workbenchService);

const createMainWindow = async (): Promise<BrowserWindow> => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "OpenGoat",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return mainWindow;
};

app.whenReady().then(async () => {
  await runtime.service.initialize();

  const ipcHandler = createIPCHandler({ router, windows: [] });

  const window = await createMainWindow();
  ipcHandler.attachWindow(window);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = await createMainWindow();
      ipcHandler.attachWindow(newWindow);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
