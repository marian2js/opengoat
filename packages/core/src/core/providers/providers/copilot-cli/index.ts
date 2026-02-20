import type { ProviderModule } from "../../provider-module.js";
import { CopilotCliProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "copilot-cli",
  create: () => new CopilotCliProvider(),
  runtime: {
    invocation: {
      cwd: "agent-workspace",
    },
    skills: {
      directories: [".copilot/skills"],
      roleSkillIds: {
        manager: ["og-boards"],
        individual: ["og-boards"],
      },
    },
  },
  onboarding: {
    env: [
      {
        key: "COPILOT_CLI_CMD",
        description: "Optional GitHub Copilot CLI binary path override",
      },
      {
        key: "GITHUB_TOKEN",
        description: "Optional GitHub token used by Copilot CLI",
        secret: true,
      },
      {
        key: "GH_TOKEN",
        description: "Optional GitHub CLI token fallback used by Copilot CLI",
        secret: true,
      },
    ],
  },
};

export { CopilotCliProvider };
