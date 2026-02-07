import type { ProviderModule } from "../../provider-module.js";
import { OpenCodeProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "opencode",
  create: () => new OpenCodeProvider(),
  onboarding: {
    env: [
      {
        key: "OPENCODE_CMD",
        description: "Optional opencode binary path override"
      },
      {
        key: "OPENCODE_MODEL",
        description: "Optional default model id in provider/model format"
      }
    ],
    auth: {
      supported: true,
      description: "Runs `opencode auth login`."
    }
  }
};

export { OpenCodeProvider };
