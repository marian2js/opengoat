import type { OpenGoatToolDefinition } from "./common.js";
import {
  BOOL_PARAM_SCHEMA,
  STRING_ARRAY_PARAM_SCHEMA,
  STRING_PARAM_SCHEMA,
  objectSchema,
} from "./common.js";
import {
  normalizeNullableManagerId,
  readOptionalBoolean,
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  resolveAgentId,
} from "./params.js";
import { successResult } from "./result.js";

const AGENT_TYPE_SCHEMA = {
  type: "string",
  enum: ["manager", "individual"],
} as const;

export function createAgentToolDefinitions(): OpenGoatToolDefinition[] {
  return [
    {
      name: "opengoat_agent_list",
      label: "OpenGoat Agent List",
      description: "List all OpenGoat agents.",
      parameters: objectSchema({}),
      async execute(_args, runtime) {
        const service = await runtime.getService();
        const agents = await service.listAgents();
        return successResult({ agents });
      },
    },
    {
      name: "opengoat_agent_info",
      label: "OpenGoat Agent Info",
      description: "Get organization info for one agent.",
      parameters: objectSchema({ agentId: STRING_PARAM_SCHEMA }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const info = await service.getAgentInfo(agentId);
        return successResult({ info });
      },
    },
    {
      name: "opengoat_agent_direct_reportees",
      label: "OpenGoat Agent Direct Reportees",
      description: "List direct reportees for an agent.",
      parameters: objectSchema({ agentId: STRING_PARAM_SCHEMA }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const reportees = await service.listDirectReportees(agentId);
        return successResult({ agentId, reportees });
      },
    },
    {
      name: "opengoat_agent_all_reportees",
      label: "OpenGoat Agent All Reportees",
      description: "List all recursive reportees for an agent.",
      parameters: objectSchema({ agentId: STRING_PARAM_SCHEMA }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const reportees = await service.listAllReportees(agentId);
        return successResult({ agentId, reportees });
      },
    },
    {
      name: "opengoat_agent_last_action",
      label: "OpenGoat Agent Last Action",
      description: "Get the latest AI action timestamp for an agent.",
      parameters: objectSchema({ agentId: STRING_PARAM_SCHEMA }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = resolveAgentId(
          readOptionalString(args.params, "agentId"),
          args.toolContext.agentId,
        );
        const lastAction = await service.getAgentLastAction(agentId);
        return successResult({ agentId, lastAction });
      },
    },
    {
      name: "opengoat_agent_create",
      label: "OpenGoat Agent Create",
      description: "Create a new OpenGoat agent.",
      parameters: objectSchema(
        {
          name: STRING_PARAM_SCHEMA,
          type: AGENT_TYPE_SCHEMA,
          reportsTo: STRING_PARAM_SCHEMA,
          role: STRING_PARAM_SCHEMA,
          skills: STRING_ARRAY_PARAM_SCHEMA,
        },
        ["name"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const name = readRequiredString(args.params, "name");
        const type = readOptionalAgentType(args.params, "type");
        const reportsTo = normalizeNullableManagerId(
          readOptionalString(args.params, "reportsTo"),
        );
        const role = readOptionalString(args.params, "role");
        const skills = readOptionalStringArray(args.params, "skills");
        const created = await service.createAgent(name, {
          type,
          reportsTo,
          role,
          skills,
        });
        return successResult({ created });
      },
    },
    {
      name: "opengoat_agent_delete",
      label: "OpenGoat Agent Delete",
      description: "Delete an OpenGoat agent.",
      parameters: objectSchema(
        {
          agentId: STRING_PARAM_SCHEMA,
          force: BOOL_PARAM_SCHEMA,
        },
        ["agentId"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = readRequiredString(args.params, "agentId");
        const force = readOptionalBoolean(args.params, "force") ?? false;
        const deleted = await service.deleteAgent(agentId, { force });
        return successResult({ deleted });
      },
    },
    {
      name: "opengoat_agent_set_manager",
      label: "OpenGoat Agent Set Manager",
      description: "Reassign who an agent reports to.",
      parameters: objectSchema(
        {
          agentId: STRING_PARAM_SCHEMA,
          managerId: STRING_PARAM_SCHEMA,
        },
        ["agentId"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const agentId = readRequiredString(args.params, "agentId");
        const managerId = normalizeNullableManagerId(
          readOptionalString(args.params, "managerId"),
        );
        const updated = await service.setAgentManager(agentId, managerId);
        return successResult({ updated });
      },
    },
  ];
}

function readOptionalAgentType(
  params: Record<string, unknown>,
  key: string,
): "manager" | "individual" | undefined {
  const value = readOptionalString(params, key);
  if (!value) {
    return undefined;
  }

  if (value !== "manager" && value !== "individual") {
    throw new Error('type must be either "manager" or "individual".');
  }

  return value;
}
