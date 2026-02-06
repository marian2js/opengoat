import type { ProviderModule } from "../../provider-module.js";
import { CursorProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "cursor",
  create: () => new CursorProvider()
};

export { CursorProvider };
