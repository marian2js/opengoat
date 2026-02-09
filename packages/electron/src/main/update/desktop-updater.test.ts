import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopAppUpdater } from "./desktop-updater";

interface FakeListener {
  (...args: unknown[]): void;
}

class FakeAutoUpdater {
  public feedUrl: string | null = null;
  public readonly checkForUpdates = vi.fn(async () => undefined);
  public readonly quitAndInstall = vi.fn(() => undefined);

  private readonly listeners = new Map<string, FakeListener[]>();

  public setFeedURL(options: { url: string }): void {
    this.feedUrl = options.url;
  }

  public on(event: string, listener: FakeListener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  public emit(event: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(event) ?? [];
    for (const listener of listeners) {
      listener(...args);
    }
  }
}

afterEach(() => {
  delete process.env.OPENGOAT_DISABLE_AUTO_UPDATE;
});

describe("DesktopAppUpdater", () => {
  it("disables updates in unpackaged environments", () => {
    const updater = new DesktopAppUpdater({
      appInstance: {
        isPackaged: false,
        getVersion: () => "0.1.0",
      },
      updater: new FakeAutoUpdater(),
      platform: "darwin",
      arch: "arm64",
    });

    updater.start();

    expect(updater.getState()).toMatchObject({
      status: "disabled",
      reason: "Auto-updates are only enabled in packaged builds.",
    });
  });

  it("checks for updates and exposes downloaded releases for install", async () => {
    const fakeUpdater = new FakeAutoUpdater();
    fakeUpdater.checkForUpdates.mockImplementation(async () => {
      fakeUpdater.emit("checking-for-update");
      fakeUpdater.emit("update-available", { version: "0.2.0" });
      fakeUpdater.emit("update-downloaded", { version: "0.2.0" });
      return undefined;
    });

    const publishedStates: string[] = [];
    const updater = new DesktopAppUpdater({
      appInstance: {
        isPackaged: true,
        getVersion: () => "0.1.0",
      },
      updater: fakeUpdater,
      platform: "darwin",
      arch: "arm64",
      now: () => "2026-02-09T00:00:00.000Z",
      onStateChange: (state) => {
        publishedStates.push(state.status);
      },
    });

    updater.start();
    await vi.waitFor(() => {
      expect(updater.getState().status).toBe("update-downloaded");
    });

    expect(fakeUpdater.feedUrl).toBe(
      "https://update.electronjs.org/marian2js/opengoat/darwin-arm64/0.1.0",
    );
    expect(updater.getState().availableVersion).toBe("0.2.0");
    expect(publishedStates).toContain("checking");
    expect(publishedStates).toContain("update-downloaded");

    expect(updater.installUpdateAndRestart()).toBe(true);
    expect(fakeUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
    updater.dispose();
  });

  it("does not install when no downloaded update is available", () => {
    const fakeUpdater = new FakeAutoUpdater();
    const updater = new DesktopAppUpdater({
      appInstance: {
        isPackaged: true,
        getVersion: () => "0.1.0",
      },
      updater: fakeUpdater,
      platform: "darwin",
      arch: "arm64",
    });

    updater.start();

    expect(updater.installUpdateAndRestart()).toBe(false);
    expect(fakeUpdater.quitAndInstall).not.toHaveBeenCalled();
    updater.dispose();
  });

  it("disables updates when repository format is invalid", () => {
    const updater = new DesktopAppUpdater({
      appInstance: {
        isPackaged: true,
        getVersion: () => "0.1.0",
      },
      updater: new FakeAutoUpdater(),
      platform: "darwin",
      arch: "arm64",
      repository: "invalid-repo",
    });

    updater.start();

    expect(updater.getState()).toMatchObject({
      status: "disabled",
      reason:
        "Auto-update repository is invalid. Expected owner/repository format.",
    });
  });
});
