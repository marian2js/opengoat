import type { ProviderModule } from "../../provider-module.js";
import { CodexProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "codex",
  create: () => new CodexProvider(),
  onboarding: {
    env: [
      {
        key: "OPENGOAT_CODEX_CMD",
        description: "Optional codex binary path override"
      }
    ],
    auth: {
      supported: true,
      description: "Runs `codex login`."
    }
  }
};

export { CodexProvider };
