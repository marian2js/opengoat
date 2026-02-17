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

export type ProviderInvocationCwdMode = "provider-default" | "agent-workspace";

export interface ProviderRuntimePolicy {
  invocation: {
    cwd: ProviderInvocationCwdMode;
  };
  skills: {
    directories: string[];
  };
}

export const DEFAULT_PROVIDER_RUNTIME_POLICY: ProviderRuntimePolicy = {
  invocation: {
    cwd: "provider-default",
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
