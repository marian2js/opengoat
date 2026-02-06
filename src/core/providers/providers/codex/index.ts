import type { ProviderModule } from "../../provider-module.js";
import { CodexProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "codex",
  create: () => new CodexProvider()
};

export { CodexProvider };
