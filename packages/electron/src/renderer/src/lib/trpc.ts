import type { AppRouter } from "@main/ipc/router";
import { createTRPCProxyClient, TRPCLink } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";

import superjson from "superjson";

const transformerLink: TRPCLink<AppRouter> = (runtime) => {
  return ipcLink<AppRouter>()({
    ...runtime,
    transformer: superjson,
  });
};

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [transformerLink],
});
