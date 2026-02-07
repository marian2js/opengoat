import { createTRPCProxyClient, createTRPCUntypedClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import superjson from "superjson";

function createLinks(): unknown[] {
  const createIpcLink = ipcLink as unknown as () => (runtime: unknown) => unknown;
  const link = createIpcLink();
  return [
    ((runtime: unknown) =>
      link({
        ...(runtime as Record<string, unknown>),
        transformer: superjson
      })) as unknown
  ];
}

let proxyClient: unknown | null = null;
let untypedClient: unknown | null = null;

export function getTrpcClient(): any {
  if (!proxyClient) {
    proxyClient = createTRPCProxyClient({ links: createLinks() as never } as never);
  }
  return proxyClient;
}

export function getTrpcUntypedClient(): any {
  if (!untypedClient) {
    untypedClient = createTRPCUntypedClient({ links: createLinks() as never } as never);
  }
  return untypedClient;
}
