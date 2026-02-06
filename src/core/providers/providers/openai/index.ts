import type { ProviderModule } from "../../provider-module.js";
import { OpenAIProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openai",
  create: () => new OpenAIProvider(),
  onboarding: {
    env: [
      {
        key: "OPENAI_API_KEY",
        description: "OpenAI API key",
        required: true,
        secret: true
      },
      {
        key: "OPENGOAT_OPENAI_BASE_URL",
        description: "Optional OpenAI-compatible base URL (for gateways/proxies)"
      },
      {
        key: "OPENGOAT_OPENAI_ENDPOINT_PATH",
        description: "Optional endpoint path (default: /responses)"
      },
      {
        key: "OPENGOAT_OPENAI_MODEL",
        description: "Optional default model id"
      },
      {
        key: "OPENGOAT_OPENAI_API_STYLE",
        description: "Optional API style override: responses or chat"
      }
    ],
    auth: {
      supported: false,
      description: "OpenAI uses API keys."
    }
  }
};

export { OpenAIProvider };
