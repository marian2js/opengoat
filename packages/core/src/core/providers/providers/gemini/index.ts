import type { ProviderModule } from "../../provider-module.js";
import { GeminiProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "gemini",
  create: () => new GeminiProvider(),
  onboarding: {
    env: [
      {
        key: "GEMINI_CMD",
        description: "Optional gemini binary path override"
      },
      {
        key: "GEMINI_MODEL",
        description: "Optional default model id"
      },
      {
        key: "GEMINI_APPROVAL_MODE",
        description: "Optional default approval mode for non-interactive runs (default: yolo)"
      },
      {
        key: "GEMINI_API_KEY",
        description: "Optional Gemini API key",
        secret: true
      },
      {
        key: "GOOGLE_API_KEY",
        description: "Optional Google API key",
        secret: true
      }
    ],
    auth: {
      supported: false,
      description: "Gemini CLI uses environment credentials or interactive first-run login."
    }
  }
};

export { GeminiProvider };
