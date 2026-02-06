import type { ProviderModule } from "../../provider-module.js";
import { ClaudeProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "claude",
  create: () => new ClaudeProvider()
};

export { ClaudeProvider };
