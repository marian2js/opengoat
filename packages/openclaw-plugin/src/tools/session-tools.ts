import type { OpenGoatToolDefinition } from "./common.js";
import {
  BOOL_PARAM_SCHEMA,
  NUMBER_PARAM_SCHEMA,
  STRING_PARAM_SCHEMA,
  objectSchema,
} from "./common.js";
import {
  readOptionalNumber,
  readOptionalString,
  readRequiredString,
  resolveAgentId,
} from "./params.js";
import { successResult } from "./result.js";

export function createSessionToolDefinitions(): OpenGoatToolDefinition[] {
  return [
    {
      name: "opengoat_session_list",
      label: "OpenGoat Session List",
      description: "List sessions for an agent.",
      parameters: objectSchema({
        agentId: STRING_PARAM_SCHEMA,
        activeMinutes: NUMBER_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const activeMinutes = readOptionalNumber(args.params, "activeMinutes");
        const sessions = await service.listSessions(agentId, { activeMinutes });
        return successResult({ agentId, sessions });
      },
    },
    {
      name: "opengoat_session_prepare",
      label: "OpenGoat Session Prepare",
      description: "Prepare and resolve a session run context.",
      parameters: objectSchema({
        agentId: STRING_PARAM_SCHEMA,
        sessionRef: STRING_PARAM_SCHEMA,
        projectPath: STRING_PARAM_SCHEMA,
        forceNew: BOOL_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const info = await service.prepareSession(agentId, {
          sessionRef: readOptionalString(args.params, "sessionRef"),
          projectPath: readOptionalString(args.params, "projectPath"),
          forceNew: readOptionalBool(args.params, "forceNew"),
        });
        return successResult({ info });
      },
    },
    {
      name: "opengoat_session_history",
      label: "OpenGoat Session History",
      description: "Read transcript history for a session.",
      parameters: objectSchema({
        agentId: STRING_PARAM_SCHEMA,
        sessionRef: STRING_PARAM_SCHEMA,
        limit: NUMBER_PARAM_SCHEMA,
        includeCompaction: BOOL_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const history = await service.getSessionHistory(agentId, {
          sessionRef: readOptionalString(args.params, "sessionRef"),
          limit: readOptionalNumber(args.params, "limit"),
          includeCompaction: readOptionalBool(args.params, "includeCompaction"),
        });
        return successResult({ history });
      },
    },
    {
      name: "opengoat_session_reset",
      label: "OpenGoat Session Reset",
      description: "Reset a session for an agent.",
      parameters: objectSchema({
        agentId: STRING_PARAM_SCHEMA,
        sessionRef: STRING_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const info = await service.resetSession(
          agentId,
          readOptionalString(args.params, "sessionRef"),
        );
        return successResult({ info });
      },
    },
    {
      name: "opengoat_session_compact",
      label: "OpenGoat Session Compact",
      description: "Force compaction for a session.",
      parameters: objectSchema({
        agentId: STRING_PARAM_SCHEMA,
        sessionRef: STRING_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const result = await service.compactSession(
          agentId,
          readOptionalString(args.params, "sessionRef"),
        );
        return successResult({ result });
      },
    },
    {
      name: "opengoat_session_rename",
      label: "OpenGoat Session Rename",
      description: "Rename a session title.",
      parameters: objectSchema(
        {
          agentId: STRING_PARAM_SCHEMA,
          sessionRef: STRING_PARAM_SCHEMA,
          title: STRING_PARAM_SCHEMA,
        },
        ["title"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const title = readRequiredString(args.params, "title");
        const session = await service.renameSession(
          agentId,
          title,
          readOptionalString(args.params, "sessionRef"),
        );
        return successResult({ session });
      },
    },
    {
      name: "opengoat_session_remove",
      label: "OpenGoat Session Remove",
      description: "Delete one session transcript and metadata entry.",
      parameters: objectSchema({
        agentId: STRING_PARAM_SCHEMA,
        sessionRef: STRING_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const removed = await service.removeSession(
          agentId,
          readOptionalString(args.params, "sessionRef"),
        );
        return successResult({ removed });
      },
    },
  ];
}

function readOptionalBool(
  params: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}
