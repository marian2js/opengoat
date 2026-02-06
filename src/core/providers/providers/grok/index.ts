import type { ProviderModule } from "../../provider-module.js";
import { GrokProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "grok",
  create: () => new GrokProvider(),
  onboarding: {
    env: [
      {
        key: "XAI_API_KEY",
        description: "xAI API key",
        required: true,
        secret: true
      },
      {
        key: "OPENGOAT_GROK_BASE_URL",
        description: "Optional Grok-compatible base URL"
      },
      {
        key: "OPENGOAT_GROK_ENDPOINT_PATH",
        description: "Optional endpoint path (default: /responses)"
      },
      {
        key: "OPENGOAT_GROK_MODEL",
        description: "Optional default model id"
      },
      {
        key: "OPENGOAT_GROK_API_STYLE",
        description: "Optional API style override: responses or chat"
      }
    ],
    auth: {
      supported: false,
      description: "Grok uses API keys."
    }
  }
};

export { GrokProvider };
