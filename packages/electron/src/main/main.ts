import { createDesktopRouter } from "@main/ipc/router";
import { WorkbenchService } from "@main/state/workbench-service";
import { WorkbenchStore } from "@main/state/workbench-store";
import { createOpenGoatRuntime } from "@opengoat/core";
import type { WorkbenchRunStatusEvent } from "@shared/workbench";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import started from "electron-squirrel-startup";
import { createIPCHandler } from "electron-trpc/main";
import path from "node:path";

const APP_NAME = "OpenGoat";
const MENU_ACTION_CHANNEL = "opengoat:menu-action";
const WINDOW_MODE_CHANNEL = "opengoat:window-mode";
const WINDOW_CHROME_CHANNEL = "opengoat:window-chrome";
const WINDOW_CHROME_GET_CHANNEL = "opengoat:window-chrome:get";
const RUN_STATUS_CHANNEL = "opengoat:run-status";

const WINDOW_SIZE = {
  workspace: {
    minWidth: 1024,
    minHeight: 700,
  },
  onboarding: {
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
  },
} as const;

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
  onRunStatus: (event) => emitRunStatus(event),
});

const router = createDesktopRouter(workbenchService);

function applyWindowMode(targetWindow: BrowserWindow, mode: WindowMode): void {
  const minimumSize = WINDOW_SIZE[mode];
  targetWindow.setMinimumSize(minimumSize.minWidth, minimumSize.minHeight);

  if (targetWindow.isMaximized() || targetWindow.isFullScreen()) {
    return;
  }

  if (mode === "onboarding") {
    targetWindow.setSize(WINDOW_SIZE.onboarding.width, WINDOW_SIZE.onboarding.height);
    targetWindow.center();
    return;
  }

  const [
    currentWidth = WINDOW_SIZE.workspace.minWidth,
    currentHeight = WINDOW_SIZE.workspace.minHeight,
  ] = targetWindow.getSize();
  const nextWidth = Math.max(currentWidth, WINDOW_SIZE.workspace.minWidth);
  const nextHeight = Math.max(currentHeight, WINDOW_SIZE.workspace.minHeight);
  if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
    targetWindow.setSize(nextWidth, nextHeight);
  }
}

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

function getWindowChromeState(targetWindow: BrowserWindow): WindowChromeState {
  return {
    isMac: process.platform === "darwin",
    isMaximized: targetWindow.isMaximized(),
    isFullScreen: targetWindow.isFullScreen(),
  };
}

function emitWindowChromeState(targetWindow: BrowserWindow): void {
  if (targetWindow.isDestroyed()) {
    return;
  }
  targetWindow.webContents.send(
    WINDOW_CHROME_CHANNEL,
    getWindowChromeState(targetWindow),
  );
}

function emitRunStatus(event: WorkbenchRunStatusEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    window.webContents.send(RUN_STATUS_CHANNEL, event);
  }
}

function attachWindowChromeTracking(targetWindow: BrowserWindow): void {
  const publish = () => emitWindowChromeState(targetWindow);
  targetWindow.on("maximize", publish);
  targetWindow.on("unmaximize", publish);
  targetWindow.on("enter-full-screen", publish);
  targetWindow.on("leave-full-screen", publish);
  targetWindow.webContents.on("did-finish-load", publish);
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
    width: WINDOW_SIZE.onboarding.width,
    height: WINDOW_SIZE.onboarding.height,
    minWidth: WINDOW_SIZE.workspace.minWidth,
    minHeight: WINDOW_SIZE.workspace.minHeight,
    title: "OpenGoat",
    // macOS-specific: integrate traffic light buttons into content area
    ...(isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 14 },
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

  ipcMain.on(WINDOW_MODE_CHANNEL, (event, mode: WindowMode) => {
    if (mode !== "workspace" && mode !== "onboarding") {
      return;
    }
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }
    applyWindowMode(targetWindow, mode);
    emitWindowChromeState(targetWindow);
  });

  ipcMain.handle(WINDOW_CHROME_GET_CHANNEL, (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || targetWindow.isDestroyed()) {
      return {
        isMac: process.platform === "darwin",
        isMaximized: false,
        isFullScreen: false,
      } satisfies WindowChromeState;
    }
    return getWindowChromeState(targetWindow);
  });

  const ipcHandler = createIPCHandler({ router: router as never, windows: [] });

  const window = await createMainWindow();
  ipcHandler.attachWindow(window);
  attachWindowChromeTracking(window);
  emitWindowChromeState(window);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = await createMainWindow();
      ipcHandler.attachWindow(newWindow);
      attachWindowChromeTracking(newWindow);
      emitWindowChromeState(newWindow);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
