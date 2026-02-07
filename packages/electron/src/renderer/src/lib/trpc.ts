import { createTRPCProxyClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import type { AppRouter } from "@main/ipc/router";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()]
});
