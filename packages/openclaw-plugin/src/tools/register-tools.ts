import type { OpenClawPluginApiLike } from "../openclaw-types.js";
import { createAgentToolDefinitions } from "./agent-tools.js";
import { materializeTool } from "./common.js";
import { createSessionToolDefinitions } from "./session-tools.js";
import { createTaskToolDefinitions } from "./task-tools.js";
import { createOpenGoatToolsRuntime } from "./runtime.js";

export function registerOpenGoatTools(api: OpenClawPluginApiLike): string[] {
  const runtime = createOpenGoatToolsRuntime();
  const definitions = [
    ...createAgentToolDefinitions(),
    ...createTaskToolDefinitions(),
    ...createSessionToolDefinitions(),
  ];

  for (const definition of definitions) {
    api.registerTool(
      (context) => materializeTool(definition, runtime, context),
      { name: definition.name },
    );
  }

  return definitions.map((definition) => definition.name);
}
