import type { ProviderModule } from "../../provider-module.js";
import { OpenRouterProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openrouter",
  create: () => new OpenRouterProvider(),
  onboarding: {
    env: [
      {
        key: "OPENROUTER_API_KEY",
        description: "OpenRouter API key",
        required: true,
        secret: true
      },
      {
        key: "OPENGOAT_OPENROUTER_ENDPOINT",
        description: "Optional endpoint override"
      },
      {
        key: "OPENGOAT_OPENROUTER_MODEL",
        description: "Optional default model id"
      },
      {
        key: "OPENGOAT_OPENROUTER_HTTP_REFERER",
        description: "Optional HTTP-Referer header"
      },
      {
        key: "OPENGOAT_OPENROUTER_X_TITLE",
        description: "Optional X-Title header"
      }
    ],
    auth: {
      supported: false,
      description: "OpenRouter uses API keys."
    }
  }
};

export { OpenRouterProvider };
