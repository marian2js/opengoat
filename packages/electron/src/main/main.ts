import { createDesktopRouter } from "@main/ipc/router";
import { WorkbenchService } from "@main/state/workbench-service";
import { WorkbenchStore } from "@main/state/workbench-store";
import { createOpenGoatRuntime } from "@opengoat/core";
import {
  app,
  BrowserWindow,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import started from "electron-squirrel-startup";
import { createIPCHandler } from "electron-trpc/main";
import path from "node:path";

const APP_NAME = "OpenGoat";
const MENU_ACTION_CHANNEL = "opengoat:menu-action";

type MenuAction =
  | "open-project"
  | "new-session"
  | "open-provider-settings"
  | "open-connection-settings";

if (started) {
  app.quit();
}

app.setName(APP_NAME);

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

function dispatchMenuAction(action: MenuAction): void {
  const target =
    BrowserWindow.getFocusedWindow() ??
    BrowserWindow.getAllWindows()[0] ??
    null;
  if (!target || target.isDestroyed()) {
    return;
  }
  target.webContents.send(MENU_ACTION_CHANNEL, action);
}

function buildApplicationMenu(): Menu {
  const isMac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    const appMenu: MenuItemConstructorOptions[] = [
      { role: "about" },
      { type: "separator" },
      {
        label: "Provider Settings...",
        accelerator: "CmdOrCtrl+,",
        click: () => dispatchMenuAction("open-provider-settings"),
      },
      {
        label: "Connection Settings...",
        click: () => dispatchMenuAction("open-connection-settings"),
      },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ];

    template.push({
      label: APP_NAME,
      submenu: appMenu,
    });
  }

  const fileMenu: MenuItemConstructorOptions[] = [
    {
      label: "Open Project...",
      accelerator: "CmdOrCtrl+O",
      click: () => dispatchMenuAction("open-project"),
    },
    {
      label: "New Session",
      accelerator: "CmdOrCtrl+N",
      click: () => dispatchMenuAction("new-session"),
    },
    { type: "separator" },
  ];
  if (isMac) {
    fileMenu.push({ role: "close" });
  } else {
    fileMenu.push(
      {
        label: "Provider Settings...",
        accelerator: "Ctrl+,",
        click: () => dispatchMenuAction("open-provider-settings"),
      },
      {
        label: "Connection Settings...",
        click: () => dispatchMenuAction("open-connection-settings"),
      },
      { type: "separator" },
      { role: "quit" },
    );
  }

  const editMenu: MenuItemConstructorOptions[] = [
    { role: "undo" },
    { role: "redo" },
    { type: "separator" },
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
  ];
  if (isMac) {
    editMenu.push(
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
      { type: "separator" },
      { role: "startSpeaking" },
      { role: "stopSpeaking" },
    );
  } else {
    editMenu.push(
      { role: "delete" },
      { type: "separator" },
      { role: "selectAll" },
    );
  }

  const windowMenu: MenuItemConstructorOptions[] = [
    { role: "minimize" },
    { role: "zoom" },
  ];
  if (isMac) {
    windowMenu.push(
      { type: "separator" },
      { role: "front" },
      { role: "window" },
    );
  } else {
    windowMenu.push({ role: "close" });
  }

  template.push(
    {
      label: "File",
      submenu: fileMenu,
    },
    {
      label: "Edit",
      submenu: editMenu,
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: windowMenu,
    },
    {
      role: "help",
      submenu: [
        {
          label: "OpenGoat Repository",
          click: () => {
            void shell.openExternal("https://github.com/marian2js/opengoat");
          },
        },
      ],
    },
  );

  return Menu.buildFromTemplate(template);
}

const createMainWindow = async (): Promise<BrowserWindow> => {
  const isMac = process.platform === "darwin";

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "OpenGoat",
    // macOS-specific: integrate traffic light buttons into content area
    ...(isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
    }),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
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
  Menu.setApplicationMenu(buildApplicationMenu());

  const ipcHandler = createIPCHandler({ router: router as never, windows: [] });

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
