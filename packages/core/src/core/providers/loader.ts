import type { ProviderRegistry } from "./registry.js";
import { providerModule as openclawProviderModule } from "./providers/openclaw/index.js";

export async function loadProviderModules(registry: ProviderRegistry): Promise<void> {
  registry.register(openclawProviderModule.id, openclawProviderModule.create, openclawProviderModule);
}
