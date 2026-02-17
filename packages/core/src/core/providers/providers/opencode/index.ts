import type { ProviderModule } from "../../provider-module.js";
import { OpenCodeProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "opencode",
  create: () => new OpenCodeProvider(),
  runtime: {
    invocation: {
      cwd: "agent-workspace",
    },
    skills: {
      directories: [".opencode/skills"],
    },
  },
  onboarding: {
    env: [
      {
        key: "OPENCODE_CMD",
        description: "Optional opencode binary path override",
      },
    ],
    auth: {
      supported: true,
      description: "Runs `opencode auth login`.",
    },
  },
};

export { OpenCodeProvider };
