import type { AppRouter } from "@main/ipc/router";
import { createTRPCProxyClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";

import superjson from "superjson";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
  transformer: superjson,
});
