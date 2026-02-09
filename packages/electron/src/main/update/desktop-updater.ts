import type { DesktopAppUpdateState } from "@shared/app-update";
import { app, autoUpdater } from "electron";

const DEFAULT_UPDATE_BASE_URL = "https://update.electronjs.org";
const DEFAULT_REPOSITORY = "marian2js/opengoat";
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

interface ElectronAppLike {
  isPackaged: boolean;
  getVersion: () => string;
}

interface ElectronAutoUpdaterLike {
  setFeedURL: (options: { url: string }) => void;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => this;
}

interface DesktopAppUpdaterDeps {
  appInstance?: ElectronAppLike;
  updater?: ElectronAutoUpdaterLike;
  platform?: NodeJS.Platform;
  arch?: string;
  now?: () => string;
  repository?: string;
  updateBaseUrl?: string;
  onStateChange?: (state: DesktopAppUpdateState) => void;
}

export class DesktopAppUpdater {
  private readonly appInstance: ElectronAppLike;
  private readonly updater: ElectronAutoUpdaterLike;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly now: () => string;
  private readonly repository: string;
  private readonly updateBaseUrl: string;
  private readonly onStateChange?: (state: DesktopAppUpdateState) => void;

  private state: DesktopAppUpdateState;
  private started = false;
  private isChecking = false;
  private checkInterval: NodeJS.Timeout | null = null;

  public constructor(deps: DesktopAppUpdaterDeps = {}) {
    this.appInstance = deps.appInstance ?? app;
    this.updater = deps.updater ?? autoUpdater;
    this.platform = deps.platform ?? process.platform;
    this.arch = deps.arch ?? process.arch;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.repository =
      deps.repository ??
      process.env.OPENGOAT_UPDATE_REPOSITORY ??
      DEFAULT_REPOSITORY;
    this.updateBaseUrl =
      deps.updateBaseUrl ??
      process.env.OPENGOAT_UPDATE_BASE_URL ??
      DEFAULT_UPDATE_BASE_URL;
    this.onStateChange = deps.onStateChange;

    this.state = {
      status: "idle",
      currentVersion: this.appInstance.getVersion(),
      availableVersion: null,
      checkedAt: null,
      reason: null,
      error: null,
    };
  }

  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    if (process.env.OPENGOAT_DISABLE_AUTO_UPDATE === "1") {
      this.publish({
        status: "disabled",
        reason: "Auto-updates are disabled by OPENGOAT_DISABLE_AUTO_UPDATE.",
      });
      return;
    }

    if (!this.appInstance.isPackaged) {
      this.publish({
        status: "disabled",
        reason: "Auto-updates are only enabled in packaged builds.",
      });
      return;
    }

    if (this.platform !== "darwin" && this.platform !== "win32") {
      this.publish({
        status: "disabled",
        reason: `Auto-updates are unsupported on ${this.platform}.`,
      });
      return;
    }

    const feedUrl = this.buildFeedUrl();
    if (!feedUrl) {
      this.publish({
        status: "disabled",
        reason:
          "Auto-update repository is invalid. Expected owner/repository format.",
      });
      return;
    }

    try {
      this.updater.setFeedURL({ url: feedUrl });
    } catch (error) {
      this.publish({
        status: "error",
        checkedAt: this.now(),
        error: normalizeError(error),
      });
      return;
    }
    this.registerUpdaterEvents();

    void this.checkForUpdates();
    this.checkInterval = setInterval(() => {
      void this.checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);
    this.checkInterval.unref();
  }

  public dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public getState(): DesktopAppUpdateState {
    return { ...this.state };
  }

  public installUpdateAndRestart(): boolean {
    if (this.state.status !== "update-downloaded") {
      return false;
    }
    this.updater.quitAndInstall();
    return true;
  }

  private registerUpdaterEvents(): void {
    this.updater.on("checking-for-update", () => {
      this.publish({
        status: "checking",
        checkedAt: this.now(),
        error: null,
        reason: null,
      });
    });

    this.updater.on("update-available", (info: unknown) => {
      this.publish({
        status: "update-available",
        availableVersion: resolveVersion(info),
        checkedAt: this.now(),
        error: null,
        reason: null,
      });
    });

    this.updater.on("update-not-available", () => {
      if (this.state.status === "update-downloaded") {
        return;
      }
      this.publish({
        status: "idle",
        availableVersion: null,
        checkedAt: this.now(),
        error: null,
        reason: null,
      });
    });

    this.updater.on("update-downloaded", (...args: unknown[]) => {
      const info = args.at(-1);
      this.publish({
        status: "update-downloaded",
        availableVersion: resolveVersion(info) ?? this.state.availableVersion,
        checkedAt: this.now(),
        error: null,
        reason: null,
      });
    });

    this.updater.on("error", (error: unknown) => {
      this.publish({
        status: "error",
        checkedAt: this.now(),
        error: normalizeError(error),
      });
    });
  }

  private async checkForUpdates(): Promise<void> {
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;
    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      this.publish({
        status: "error",
        checkedAt: this.now(),
        error: normalizeError(error),
      });
    } finally {
      this.isChecking = false;
    }
  }

  private publish(
    patch: Partial<DesktopAppUpdateState> & Pick<DesktopAppUpdateState, "status">,
  ): void {
    this.state = {
      ...this.state,
      ...patch,
    };
    this.onStateChange?.({ ...this.state });
  }

  private buildFeedUrl(): string | null {
    const normalizedRepository = this.repository.trim().replace(/^\/+|\/+$/g, "");
    if (!normalizedRepository.includes("/")) {
      return null;
    }
    const normalizedBaseUrl = this.updateBaseUrl.trim().replace(/\/+$/g, "");
    const version = encodeURIComponent(this.appInstance.getVersion());
    return `${normalizedBaseUrl}/${normalizedRepository}/${this.platform}-${this.arch}/${version}`;
  }
}

function resolveVersion(info: unknown): string | null {
  if (!info || typeof info !== "object") {
    return null;
  }
  const version = Reflect.get(info, "version");
  return typeof version === "string" && version.trim().length > 0
    ? version.trim()
    : null;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "Unknown update error.";
}
