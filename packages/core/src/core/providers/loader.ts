import type { ProviderRegistry } from "./registry.js";
import { providerModule as claudeCodeProviderModule } from "./providers/claude-code/index.js";
import { providerModule as codexProviderModule } from "./providers/codex/index.js";
import { providerModule as cursorProviderModule } from "./providers/cursor/index.js";
import { providerModule as openclawProviderModule } from "./providers/openclaw/index.js";

export async function loadProviderModules(registry: ProviderRegistry): Promise<void> {
  registry.register(
    claudeCodeProviderModule.id,
    claudeCodeProviderModule.create,
    claudeCodeProviderModule,
  );
  registry.register(
    codexProviderModule.id,
    codexProviderModule.create,
    codexProviderModule,
  );
  registry.register(
    cursorProviderModule.id,
    cursorProviderModule.create,
    cursorProviderModule,
  );
  registry.register(openclawProviderModule.id, openclawProviderModule.create, openclawProviderModule);
}
