import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { listenWithPortFallback } from "./startup.js";

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
