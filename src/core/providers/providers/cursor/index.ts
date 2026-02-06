import type { ProviderModule } from "../../provider-module.js";
import { CursorProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "cursor",
  create: () => new CursorProvider(),
  onboarding: {
    env: [
      {
        key: "OPENGOAT_CURSOR_CMD",
        description: "Optional cursor binary path override"
      }
    ],
    auth: {
      supported: true,
      description: "Runs `cursor agent login` (or `cursor-agent login`)."
    }
  }
};

export { CursorProvider };
