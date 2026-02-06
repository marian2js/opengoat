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

export interface ProviderModule {
  id: string;
  create: () => Provider;
  onboarding?: ProviderOnboardingSpec;
}
