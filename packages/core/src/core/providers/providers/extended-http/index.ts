import type { ProviderModule } from "../../provider-module.js";
import {
  extendedHttpProviderCatalog,
  resolveExtendedHttpProviderModelEnvVar,
  resolveExtendedHttpProviderOnboarding,
  type ExtendedHttpProviderSpec
} from "./catalog.js";
import { ExtendedHttpProvider } from "./provider.js";

export const providerModules: ProviderModule[] = extendedHttpProviderCatalog.map((spec) =>
  createProviderModule(spec)
);

function createProviderModule(spec: ExtendedHttpProviderSpec): ProviderModule {
  return {
    id: spec.id,
    create: () => new ExtendedHttpProvider(spec),
    onboarding: resolveExtendedHttpProviderOnboarding(spec)
  };
}

export { ExtendedHttpProvider };
export {
  extendedHttpProviderCatalog,
  resolveExtendedHttpProviderModelEnvVar,
  resolveExtendedHttpProviderOnboarding
} from "./catalog.js";
