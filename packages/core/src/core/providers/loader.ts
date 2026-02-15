import type { ProviderRegistry } from "./registry.js";
import { providerModule as claudeCodeProviderModule } from "./providers/claude-code/index.js";
import { providerModule as openclawProviderModule } from "./providers/openclaw/index.js";

export async function loadProviderModules(registry: ProviderRegistry): Promise<void> {
  registry.register(
    claudeCodeProviderModule.id,
    claudeCodeProviderModule.create,
    claudeCodeProviderModule,
  );
  registry.register(openclawProviderModule.id, openclawProviderModule.create, openclawProviderModule);
}
