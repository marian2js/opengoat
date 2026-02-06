import type { ProviderModule } from "../../provider-module.js";
import { OpenRouterProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openrouter",
  create: () => new OpenRouterProvider()
};

export { OpenRouterProvider };
