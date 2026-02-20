import type { ProviderModule } from "../provider-module.js";
import { providerModule as claudeCodeProviderModule } from "./claude-code/index.js";
import { providerModule as codexProviderModule } from "./codex/index.js";
import { providerModule as copilotCliProviderModule } from "./copilot-cli/index.js";
import { providerModule as cursorProviderModule } from "./cursor/index.js";
import { providerModule as geminiCliProviderModule } from "./gemini-cli/index.js";
import { providerModule as opencodeProviderModule } from "./opencode/index.js";
import { providerModule as openclawProviderModule } from "./openclaw/index.js";

// Central registry for built-in providers.
// Add new built-in provider modules here so they are available across CLI, API, and UI.
export const BUILTIN_PROVIDER_MODULES: ProviderModule[] = [
  claudeCodeProviderModule,
  codexProviderModule,
  copilotCliProviderModule,
  cursorProviderModule,
  geminiCliProviderModule,
  openclawProviderModule,
  opencodeProviderModule,
];
