import type { AppRouter } from "@main/ipc/router";
import {
  createTRPCProxyClient,
  type TRPCLink
} from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import superjson from "superjson";

const transformerLink: TRPCLink<AppRouter> = (runtime) => {
  return ipcLink<AppRouter>()({
    ...runtime,
    transformer: superjson
  });
};

let proxyClient: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

export function getTrpcClient(): ReturnType<typeof createTRPCProxyClient<AppRouter>> {
  if (!proxyClient) {
    proxyClient = createTRPCProxyClient<AppRouter>({
      links: [transformerLink]
    });
  }
  return proxyClient;
}
