import { exposeElectronTRPC } from "electron-trpc/main";

process.once("loaded", () => {
  exposeElectronTRPC();
});
