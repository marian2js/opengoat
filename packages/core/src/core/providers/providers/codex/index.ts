import type { ProviderModule } from "../../provider-module.js";
import { CodexProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "codex",
  create: () => new CodexProvider(),
  runtime: {
    invocation: {
      cwd: "agent-workspace",
    },
    skills: {
      directories: [".agents/skills"],
    },
  },
  onboarding: {
    env: [
      {
        key: "CODEX_CMD",
        description: "Optional codex binary path override",
      },
      {
        key: "OPENAI_API_KEY",
        description: "Optional API key for Codex auth and execution",
        secret: true,
      },
    ],
    auth: {
      supported: true,
      description: "Runs `codex login`.",
    },
  },
};

export { CodexProvider };
