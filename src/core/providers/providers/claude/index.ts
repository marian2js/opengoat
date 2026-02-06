import type { ProviderModule } from "../../provider-module.js";
import { ClaudeProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "claude",
  create: () => new ClaudeProvider(),
  onboarding: {
    env: [
      {
        key: "OPENGOAT_CLAUDE_CMD",
        description: "Optional claude binary path override"
      }
    ],
    auth: {
      supported: true,
      description: "Runs `claude setup-token`."
    }
  }
};

export { ClaudeProvider };
