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
        key: "OPENAI_BASE_URL",
        description: "Optional OpenAI-compatible base URL (for gateways/proxies)"
      },
      {
        key: "OPENAI_ENDPOINT_PATH",
        description:
          "Optional endpoint path override (for example: /responses or /chat/completions)"
      },
      {
        key: "OPENAI_ENDPOINT",
        description: "Optional full endpoint override"
      },
      {
        key: "OPENAI_MODEL",
        description: "Optional default model id"
      },
      {
        key: "OPENAI_REQUEST_TIMEOUT_MS",
        description:
          "Optional request timeout in milliseconds (default: 120000 for api.openai.com, 60000 for compatible base URLs)"
      },
      {
        key: "OPENAI_API_STYLE",
        description:
          "Optional API style override: responses or chat (default: responses for api.openai.com, chat for compatible base URLs)"
      }
    ],
    auth: {
      supported: false,
      description: "OpenAI uses API keys."
    }
  }
};

export { OpenAIProvider };
