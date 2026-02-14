import type { FastifyInstance } from "fastify";

const MAX_PORT = 65535;

export interface ListenWithPortFallbackOptions {
  host: string;
  port: number;
}

export interface ListenWithPortFallbackResult {
  requestedPort: number;
  resolvedPort: number;
}

export async function listenWithPortFallback(
  server: FastifyInstance,
  options: ListenWithPortFallbackOptions,
): Promise<ListenWithPortFallbackResult> {
  const requestedPort = options.port;
  let currentPort = requestedPort;

  while (currentPort <= MAX_PORT) {
    try {
      await server.listen({
        host: options.host,
        port: currentPort,
      });
      return {
        requestedPort,
        resolvedPort: currentPort,
      };
    } catch (error) {
      if (!isAddressInUseError(error)) {
        throw error;
      }

      server.log.warn(
        {
          host: options.host,
          requestedPort,
          attemptedPort: currentPort,
          nextPort: currentPort + 1,
        },
        "OpenGoat UI port already in use; retrying with next port.",
      );
      currentPort += 1;
    }
  }

  throw new Error(
    `OpenGoat UI failed to find a free port from ${requestedPort} to ${MAX_PORT}.`,
  );
}

function isAddressInUseError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (maybeCode === "EADDRINUSE") {
    return true;
  }

  const maybeMessage = (error as { message?: unknown }).message;
  return (
    typeof maybeMessage === "string" &&
    maybeMessage.includes("EADDRINUSE")
  );
}
