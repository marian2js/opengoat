import type { ProviderModule } from "../../provider-module.js";
import { GeminiCliProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "gemini-cli",
  create: () => new GeminiCliProvider(),
  runtime: {
    invocation: {
      cwd: "agent-workspace",
    },
    skills: {
      directories: [".gemini/skills"],
    },
  },
  onboarding: {
    env: [
      {
        key: "GEMINI_CMD",
        description: "Optional gemini binary path override",
      },
      {
        key: "GEMINI_API_KEY",
        description: "Optional API key for Gemini CLI headless execution",
        secret: true,
      },
      {
        key: "GOOGLE_GENAI_USE_VERTEXAI",
        description: "Optional auth mode toggle for Vertex AI",
      },
      {
        key: "GOOGLE_GENAI_USE_GCA",
        description: "Optional auth mode toggle for Google Cloud auth",
      },
    ],
  },
};

export { GeminiCliProvider };
