import type { ProviderModule } from "../../provider-module.js";
import { CursorProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "cursor",
  create: () => new CursorProvider(),
  runtime: {
    invocation: {
      cwd: "agent-workspace",
    },
    skills: {
      directories: [".cursor/skills"],
    },
  },
  onboarding: {
    env: [
      {
        key: "CURSOR_CMD",
        description: "Optional cursor binary path override",
      },
      {
        key: "CURSOR_API_KEY",
        description: "Optional API key for Cursor Agent authentication",
        secret: true,
      },
    ],
    auth: {
      supported: true,
      description: "Runs `cursor agent login`.",
    },
  },
};

export { CursorProvider };
