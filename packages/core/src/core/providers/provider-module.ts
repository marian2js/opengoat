import type { Provider } from "./types.js";

export interface ProviderOnboardingEnvField {
  key: string;
  description: string;
  required?: boolean;
  secret?: boolean;
}

export interface ProviderOnboardingSpec {
  env?: ProviderOnboardingEnvField[];
  auth?: {
    supported: boolean;
    description: string;
  };
}

export type ProviderInvocationCwdMode = "session-project" | "agent-workspace";

export interface ProviderRuntimePolicy {
  invocation: {
    cwd: ProviderInvocationCwdMode;
    includeProjectContextPrompt: boolean;
  };
  skills: {
    directories: string[];
  };
}

export const DEFAULT_PROVIDER_RUNTIME_POLICY: ProviderRuntimePolicy = {
  invocation: {
    cwd: "session-project",
    includeProjectContextPrompt: true,
  },
  skills: {
    directories: ["skills"],
  },
};

export interface ProviderModule {
  id: string;
  create: () => Provider;
  onboarding?: ProviderOnboardingSpec;
  runtime?: ProviderRuntimePolicy;
}
