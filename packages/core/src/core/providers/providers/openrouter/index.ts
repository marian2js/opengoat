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
        key: "OPENROUTER_ENDPOINT",
        description: "Optional endpoint override"
      },
      {
        key: "OPENROUTER_MODEL",
        description: "Optional default model id"
      },
      {
        key: "OPENROUTER_HTTP_REFERER",
        description: "Optional HTTP-Referer header"
      },
      {
        key: "OPENROUTER_X_TITLE",
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
