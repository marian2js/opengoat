export function defaultModelForProvider(
  providerId: string | undefined,
): string | undefined {
  switch (providerId) {
    case "anthropic":
      return "claude-sonnet-4-5";
    case "github-copilot":
      return "github-copilot/gpt-4o";
    case "google":
      return "gemini-2.5-pro";
    case "openai":
      return "openai/gpt-5";
    case "openai-codex":
      return "openai-codex/gpt-5.4";
    default:
      return undefined;
  }
}

export function normalizeGatewayModelRef(params: {
  modelId?: string | undefined;
  providerId?: string | undefined;
}): string | undefined {
  const modelId = params.modelId?.trim();
  if (!modelId) {
    return defaultModelForProvider(params.providerId);
  }

  if (modelId.includes("/")) {
    return modelId;
  }

  const providerId = params.providerId?.trim();
  return providerId ? `${providerId}/${modelId}` : modelId;
}

export function splitGatewayModelRef(modelRef?: string | null): {
  modelId?: string;
  providerId?: string;
} {
  const normalized = modelRef?.trim();
  if (!normalized) {
    return {};
  }

  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0) {
    return { modelId: normalized };
  }

  return {
    modelId: normalized.slice(slashIndex + 1),
    providerId: normalized.slice(0, slashIndex),
  };
}
