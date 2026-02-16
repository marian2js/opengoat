import type { ProviderRegistry } from "./registry.js";
import { BUILTIN_PROVIDER_MODULES } from "./providers/registry.js";

export async function loadProviderModules(registry: ProviderRegistry): Promise<void> {
  for (const providerModule of BUILTIN_PROVIDER_MODULES) {
    registry.register(
      providerModule.id,
      providerModule.create,
      providerModule,
    );
  }
}
