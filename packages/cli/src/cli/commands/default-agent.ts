import { DEFAULT_AGENT_ID } from "@opengoat/core";
import type { CliContext } from "../framework/command.js";

export async function resolveCliDefaultAgentId(
  context: CliContext,
): Promise<string> {
  const resolver = (
    context.service as {
      getDefaultAgentId?: (options?: {
        requireExisting?: boolean;
      }) => Promise<string>;
    }
  ).getDefaultAgentId;
  if (typeof resolver !== "function") {
    return DEFAULT_AGENT_ID;
  }
  const resolved = await resolver.call(context.service, { requireExisting: true });
  return resolved?.trim() || DEFAULT_AGENT_ID;
}
