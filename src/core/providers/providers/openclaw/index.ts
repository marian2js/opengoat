import type { ProviderModule } from "../../provider-module.js";
import { OpenClawProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openclaw",
  create: () => new OpenClawProvider(),
  onboarding: {
    env: [
      {
        key: "OPENGOAT_OPENCLAW_CMD",
        description: "Optional openclaw binary path override"
      }
    ],
    auth: {
      supported: true,
      description: "Runs `openclaw onboard` by default."
    }
  }
};

export { OpenClawProvider };
