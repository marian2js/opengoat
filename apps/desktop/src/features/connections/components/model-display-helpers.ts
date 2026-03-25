import type { ProviderModelCatalog } from "@/app/types";

/**
 * Resolve a human-readable model label from the provider model catalog,
 * falling back to the raw activeModelId or an em-dash when nothing is available.
 */
export function resolveModelDisplayLabel(
  catalog: ProviderModelCatalog | undefined,
  activeModelId: string | undefined,
): string {
  if (catalog && catalog.models.length > 0) {
    // Prefer the model marked as selected
    const selected = catalog.models.find((m) => m.isSelected);
    if (selected) return selected.label;

    // Fall back to matching by currentModelRef
    if (catalog.currentModelRef) {
      const byRef = catalog.models.find((m) => m.modelRef === catalog.currentModelRef);
      if (byRef) return byRef.label;
    }

    // Fall back to first model in the list
    return catalog.models[0].label;
  }

  // No catalog available — use the raw model ID if present
  if (activeModelId) return activeModelId;

  return "\u2014";
}
