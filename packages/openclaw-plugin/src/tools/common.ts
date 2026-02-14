import type {
  OpenClawPluginToolContextLike,
  OpenClawToolLike,
  OpenClawToolResultLike,
} from "../openclaw-types.js";
import type { OpenGoatToolsRuntime } from "./runtime.js";
import { asRecord } from "./params.js";
import { errorResult } from "./result.js";

export type ToolExecuteContext = {
  params: Record<string, unknown>;
  callId: string;
  signal?: AbortSignal;
  toolContext: OpenClawPluginToolContextLike;
};

export interface OpenGoatToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    args: ToolExecuteContext,
    runtime: OpenGoatToolsRuntime,
  ): Promise<OpenClawToolResultLike>;
}

export function materializeTool(
  definition: OpenGoatToolDefinition,
  runtime: OpenGoatToolsRuntime,
  toolContext: OpenClawPluginToolContextLike,
): OpenClawToolLike {
  return {
    name: definition.name,
    label: definition.label,
    description: definition.description,
    parameters: definition.parameters,
    async execute(callId, params, signal) {
      try {
        return await definition.execute(
          {
            callId,
            params: asRecord(params),
            signal,
            toolContext,
          },
          runtime,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}

export const STRING_PARAM_SCHEMA = {
  type: "string",
} as const;

export const BOOL_PARAM_SCHEMA = {
  type: "boolean",
} as const;

export const NUMBER_PARAM_SCHEMA = {
  type: "number",
} as const;

export const STRING_ARRAY_PARAM_SCHEMA = {
  type: "array",
  items: {
    type: "string",
  },
} as const;

export function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
