import type { ProviderModule } from "../../provider-module.js";
import { OpenAIProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openai",
  create: () => new OpenAIProvider()
};

export { OpenAIProvider };
