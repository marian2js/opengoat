import type { ProviderModule } from "../../provider-module.js";
import {
  openClawCompatProviderCatalog,
  resolveOpenClawCompatOnboarding,
  type OpenClawCompatProviderSpec
} from "./catalog.js";
import { OpenClawCompatProvider } from "./provider.js";

export const providerModules: ProviderModule[] = openClawCompatProviderCatalog.map((spec) =>
  createProviderModule(spec)
);

function createProviderModule(spec: OpenClawCompatProviderSpec): ProviderModule {
  return {
    id: spec.id,
    create: () => new OpenClawCompatProvider(spec),
    onboarding: resolveOpenClawCompatOnboarding(spec)
  };
}

export { OpenClawCompatProvider };
export {
  openClawCompatProviderCatalog,
  resolveOpenClawCompatModelEnvVar,
  resolveOpenClawCompatProviderId
} from "./catalog.js";

