import type { ProviderModule } from "../../provider-module.js";
import { GrokProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "grok",
  create: () => new GrokProvider()
};

export { GrokProvider };
