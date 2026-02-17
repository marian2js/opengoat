import type { ProviderModule } from "../../provider-module.js";
import { OpenClawProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openclaw",
  create: () => new OpenClawProvider(),
  runtime: {
    invocation: {
      cwd: "provider-default",
    },
    skills: {
      directories: ["skills"],
    },
  },
  onboarding: {
    env: [
      {
        key: "OPENCLAW_CMD",
        description: "Optional openclaw binary path override",
      },
      {
        key: "OPENCLAW_GATEWAY_URL",
        description:
          "Optional remote gateway URL (e.g. ws://remote-host:18789)",
      },
      {
        key: "OPENCLAW_GATEWAY_PASSWORD",
        description: "Optional remote gateway password/token",
      },
      {
        key: "OPENCLAW_ARGUMENTS",
        description:
          "Optional extra arguments to pass to openclaw (e.g. --remote)",
      },
    ],
    auth: {
      supported: true,
      description: "Runs `openclaw onboard` by default.",
    },
  },
};

export { OpenClawProvider };
