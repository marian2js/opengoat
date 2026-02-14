import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  listenWithPortFallback,
  openUrlInBrowserWithDeps,
  resolveBrowserOpenCommand,
} from "./startup.js";

function createMockServer(
  listenImpl: (args: { host: string; port: number }) => Promise<void>,
): FastifyInstance {
  return {
    listen: vi.fn(listenImpl),
    log: {
      warn: vi.fn(),
    },
  } as unknown as FastifyInstance;
}

describe("listenWithPortFallback", () => {
  it("listens on requested port when it is available", async () => {
    const server = createMockServer(async () => {});

    const result = await listenWithPortFallback(server, {
      host: "127.0.0.1",
      port: 19123,
    });

    expect(result).toEqual({
      requestedPort: 19123,
      resolvedPort: 19123,
    });
    expect(server.listen).toHaveBeenCalledTimes(1);
    expect(server.listen).toHaveBeenCalledWith({
      host: "127.0.0.1",
      port: 19123,
    });
  });

  it("retries with next port when requested port is in use", async () => {
    const server = createMockServer(async ({ port }) => {
      if (port === 19123) {
        const error = new Error("listen EADDRINUSE: address already in use");
        (error as Error & { code?: string }).code = "EADDRINUSE";
        throw error;
      }
    });

    const result = await listenWithPortFallback(server, {
      host: "127.0.0.1",
      port: 19123,
    });

    expect(result).toEqual({
      requestedPort: 19123,
      resolvedPort: 19124,
    });
    expect(server.listen).toHaveBeenCalledTimes(2);
    expect(server.listen).toHaveBeenNthCalledWith(1, {
      host: "127.0.0.1",
      port: 19123,
    });
    expect(server.listen).toHaveBeenNthCalledWith(2, {
      host: "127.0.0.1",
      port: 19124,
    });
    expect(server.log.warn).toHaveBeenCalledTimes(1);
  });

  it("throws non-address-in-use errors", async () => {
    const server = createMockServer(async () => {
      throw new Error("Unexpected listen failure");
    });

    await expect(
      listenWithPortFallback(server, {
        host: "127.0.0.1",
        port: 19123,
      }),
    ).rejects.toThrow("Unexpected listen failure");
  });

  it("throws when no free ports remain", async () => {
    const server = createMockServer(async () => {
      const error = new Error("listen EADDRINUSE: address already in use");
      (error as Error & { code?: string }).code = "EADDRINUSE";
      throw error;
    });

    await expect(
      listenWithPortFallback(server, {
        host: "127.0.0.1",
        port: 65535,
      }),
    ).rejects.toThrow("failed to find a free port");
  });
});

describe("resolveBrowserOpenCommand", () => {
  it("returns macOS open command", () => {
    expect(
      resolveBrowserOpenCommand("darwin", "http://127.0.0.1:19123"),
    ).toEqual({
      command: "open",
      args: ["http://127.0.0.1:19123"],
    });
  });

  it("returns Linux xdg-open command", () => {
    expect(
      resolveBrowserOpenCommand("linux", "http://127.0.0.1:19123"),
    ).toEqual({
      command: "xdg-open",
      args: ["http://127.0.0.1:19123"],
    });
  });

  it("returns Windows start command", () => {
    expect(
      resolveBrowserOpenCommand("win32", "http://127.0.0.1:19123"),
    ).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "http://127.0.0.1:19123"],
    });
  });

  it("returns undefined on unsupported platforms", () => {
    expect(
      resolveBrowserOpenCommand("freebsd", "http://127.0.0.1:19123"),
    ).toBeUndefined();
  });
});

describe("openUrlInBrowserWithDeps", () => {
  it("spawns browser command when supported", () => {
    const on = vi.fn();
    const unref = vi.fn();
    const spawnProcess = vi.fn(() => ({
      on,
      unref,
    }));

    openUrlInBrowserWithDeps("http://127.0.0.1:19123", {
      platform: "darwin",
      spawnProcess,
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      "open",
      ["http://127.0.0.1:19123"],
      { detached: true, stdio: "ignore" },
    );
    expect(on).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it("does nothing on unsupported platform", () => {
    const spawnProcess = vi.fn();

    openUrlInBrowserWithDeps("http://127.0.0.1:19123", {
      platform: "freebsd",
      spawnProcess,
    });

    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("swallows spawn failures", () => {
    const spawnProcess = vi.fn(() => {
      throw new Error("spawn failed");
    });

    expect(() =>
      openUrlInBrowserWithDeps("http://127.0.0.1:19123", {
        platform: "darwin",
        spawnProcess,
      }),
    ).not.toThrow();
  });
});
