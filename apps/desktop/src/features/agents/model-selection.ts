import type { Agent } from "@/app/types";

export function buildAgentModelUpdatePayload(params: {
  agent: Agent;
  effectiveProviderId: string;
  nextModelId: string;
  selectedProviderId: string | undefined;
}): {
  modelId?: string;
  providerId?: string;
} {
  const nextModelId = params.nextModelId.trim();

  if (nextModelId) {
    return {
      modelId: nextModelId,
      providerId: params.effectiveProviderId,
    };
  }

  return {
    modelId: "",
    ...(params.agent.providerId ||
    params.effectiveProviderId !== params.selectedProviderId
      ? { providerId: params.effectiveProviderId }
      : {}),
  };
}
