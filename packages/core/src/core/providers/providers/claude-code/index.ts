import type { ProviderModule } from "../../provider-module.js";
import { ClaudeCodeProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "claude-code",
  create: () => new ClaudeCodeProvider(),
  runtime: {
    invocation: {
      cwd: "agent-workspace",
    },
    skills: {
      directories: [".claude/skills"],
    },
  },
  onboarding: {
    env: [
      {
        key: "CLAUDE_CODE_CMD",
        description: "Optional claude binary path override",
      },
      {
        key: "ANTHROPIC_API_KEY",
        description: "Optional API key for non-interactive Claude Code execution",
        secret: true,
      },
    ],
    auth: {
      supported: true,
      description: "Runs `claude auth login`.",
    },
  },
};

export { ClaudeCodeProvider };
