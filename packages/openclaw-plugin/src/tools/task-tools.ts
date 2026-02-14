import type { OpenGoatToolDefinition } from "./common.js";
import {
  BOOL_PARAM_SCHEMA,
  NUMBER_PARAM_SCHEMA,
  STRING_ARRAY_PARAM_SCHEMA,
  STRING_PARAM_SCHEMA,
  objectSchema,
} from "./common.js";
import {
  readOptionalBoolean,
  readOptionalNumber,
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  resolveAgentId,
} from "./params.js";
import { successResult } from "./result.js";

const TASK_STATUS_SCHEMA = {
  type: "string",
  enum: ["todo", "doing", "pending", "blocked", "done"],
} as const;

export function createTaskToolDefinitions(): OpenGoatToolDefinition[] {
  return [
    {
      name: "opengoat_task_create",
      label: "OpenGoat Task Create",
      description: "Create a task as an agent.",
      parameters: objectSchema(
        {
          actorId: STRING_PARAM_SCHEMA,
          title: STRING_PARAM_SCHEMA,
          description: STRING_PARAM_SCHEMA,
          project: STRING_PARAM_SCHEMA,
          assignedTo: STRING_PARAM_SCHEMA,
          status: TASK_STATUS_SCHEMA,
        },
        ["title", "description"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const actorId = resolveAgentId(
          readOptionalString(args.params, "actorId"),
          args.toolContext.agentId,
        );
        const title = readRequiredString(args.params, "title");
        const description = readRequiredString(args.params, "description");
        const project = readOptionalString(args.params, "project");
        const assignedTo = readOptionalString(args.params, "assignedTo");
        const status = readOptionalString(args.params, "status");

        const task = await service.createTask(actorId, {
          title,
          description,
          project,
          assignedTo,
          status,
        });

        return successResult({ task });
      },
    },
    {
      name: "opengoat_task_list",
      label: "OpenGoat Task List",
      description: "List tasks with optional assignee/limit filters.",
      parameters: objectSchema({
        assignee: STRING_PARAM_SCHEMA,
        limit: NUMBER_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const assignee = readOptionalString(args.params, "assignee");
        const limit = readOptionalNumber(args.params, "limit");
        const tasks = await service.listTasks({ assignee, limit });
        return successResult({ tasks, count: tasks.length });
      },
    },
    {
      name: "opengoat_task_list_latest",
      label: "OpenGoat Task List Latest",
      description: "List latest tasks with optional assignee/limit filters.",
      parameters: objectSchema({
        assignee: STRING_PARAM_SCHEMA,
        limit: NUMBER_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const assignee = readOptionalString(args.params, "assignee");
        const limit = readOptionalNumber(args.params, "limit");
        const tasks = await service.listLatestTasks({ assignee, limit });
        return successResult({ tasks, count: tasks.length });
      },
    },
    {
      name: "opengoat_task_list_latest_page",
      label: "OpenGoat Task List Latest Page",
      description: "List paginated latest tasks.",
      parameters: objectSchema({
        assignee: STRING_PARAM_SCHEMA,
        owner: STRING_PARAM_SCHEMA,
        status: STRING_PARAM_SCHEMA,
        limit: NUMBER_PARAM_SCHEMA,
        offset: NUMBER_PARAM_SCHEMA,
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const page = await service.listLatestTasksPage({
          assignee: readOptionalString(args.params, "assignee"),
          owner: readOptionalString(args.params, "owner"),
          status: readOptionalString(args.params, "status"),
          limit: readOptionalNumber(args.params, "limit"),
          offset: readOptionalNumber(args.params, "offset"),
        });
        return successResult({ page });
      },
    },
    {
      name: "opengoat_task_get",
      label: "OpenGoat Task Get",
      description: "Get one task by id.",
      parameters: objectSchema({ taskId: STRING_PARAM_SCHEMA }, ["taskId"]),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const taskId = readRequiredString(args.params, "taskId");
        const task = await service.getTask(taskId);
        return successResult({ task });
      },
    },
    {
      name: "opengoat_task_delete",
      label: "OpenGoat Task Delete",
      description: "Delete one or more tasks as an actor.",
      parameters: objectSchema(
        {
          actorId: STRING_PARAM_SCHEMA,
          taskIds: STRING_ARRAY_PARAM_SCHEMA,
        },
        ["taskIds"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const actorId = resolveAgentId(
          readOptionalString(args.params, "actorId"),
          args.toolContext.agentId,
        );
        const taskIds = readOptionalStringArray(args.params, "taskIds") ?? [];
        if (taskIds.length === 0) {
          throw new Error("taskIds must contain at least one id.");
        }

        const deleted = await service.deleteTasks(actorId, taskIds);
        return successResult({ deleted });
      },
    },
    {
      name: "opengoat_task_update_status",
      label: "OpenGoat Task Update Status",
      description: "Update task status as an actor.",
      parameters: objectSchema(
        {
          actorId: STRING_PARAM_SCHEMA,
          taskId: STRING_PARAM_SCHEMA,
          status: TASK_STATUS_SCHEMA,
          reason: STRING_PARAM_SCHEMA,
        },
        ["taskId", "status"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const actorId = resolveAgentId(
          readOptionalString(args.params, "actorId"),
          args.toolContext.agentId,
        );
        const taskId = readRequiredString(args.params, "taskId");
        const status = readRequiredString(args.params, "status");
        const reason = readOptionalString(args.params, "reason");
        const task = await service.updateTaskStatus(actorId, taskId, status, reason);
        return successResult({ task });
      },
    },
    {
      name: "opengoat_task_add_blocker",
      label: "OpenGoat Task Add Blocker",
      description: "Add a blocker entry to a task.",
      parameters: objectSchema(
        {
          actorId: STRING_PARAM_SCHEMA,
          taskId: STRING_PARAM_SCHEMA,
          blocker: STRING_PARAM_SCHEMA,
        },
        ["taskId", "blocker"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const actorId = resolveAgentId(
          readOptionalString(args.params, "actorId"),
          args.toolContext.agentId,
        );
        const taskId = readRequiredString(args.params, "taskId");
        const blocker = readRequiredString(args.params, "blocker");
        const task = await service.addTaskBlocker(actorId, taskId, blocker);
        return successResult({ task });
      },
    },
    {
      name: "opengoat_task_add_artifact",
      label: "OpenGoat Task Add Artifact",
      description: "Add an artifact entry to a task.",
      parameters: objectSchema(
        {
          actorId: STRING_PARAM_SCHEMA,
          taskId: STRING_PARAM_SCHEMA,
          content: STRING_PARAM_SCHEMA,
        },
        ["taskId", "content"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const actorId = resolveAgentId(
          readOptionalString(args.params, "actorId"),
          args.toolContext.agentId,
        );
        const taskId = readRequiredString(args.params, "taskId");
        const content = readRequiredString(args.params, "content");
        const task = await service.addTaskArtifact(actorId, taskId, content);
        return successResult({ task });
      },
    },
    {
      name: "opengoat_task_add_worklog",
      label: "OpenGoat Task Add Worklog",
      description: "Add a worklog entry to a task.",
      parameters: objectSchema(
        {
          actorId: STRING_PARAM_SCHEMA,
          taskId: STRING_PARAM_SCHEMA,
          content: STRING_PARAM_SCHEMA,
        },
        ["taskId", "content"],
      ),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const actorId = resolveAgentId(
          readOptionalString(args.params, "actorId"),
          args.toolContext.agentId,
        );
        const taskId = readRequiredString(args.params, "taskId");
        const content = readRequiredString(args.params, "content");
        const task = await service.addTaskWorklog(actorId, taskId, content);
        return successResult({ task });
      },
    },
    {
      name: "opengoat_task_cron_run",
      label: "OpenGoat Task Cron Run",
      description: "Run one cycle of task automation checks.",
      parameters: objectSchema({
        inactiveMinutes: NUMBER_PARAM_SCHEMA,
        notifyInactiveAgents: BOOL_PARAM_SCHEMA,
        notificationTarget: {
          type: "string",
          enum: ["all-managers", "ceo-only"],
        },
      }),
      async execute(args, runtime) {
        const service = await runtime.getService();
        const result = await service.runTaskCronCycle({
          inactiveMinutes: readOptionalNumber(args.params, "inactiveMinutes"),
          notifyInactiveAgents:
            readOptionalBoolean(args.params, "notifyInactiveAgents"),
          notificationTarget: readOptionalNotificationTarget(
            args.params,
            "notificationTarget",
          ),
        });

        return successResult({ result });
      },
    },
  ];
}

function readOptionalNotificationTarget(
  params: Record<string, unknown>,
  key: string,
): "all-managers" | "ceo-only" | undefined {
  const value = readOptionalString(params, key);
  if (!value) {
    return undefined;
  }

  if (value !== "all-managers" && value !== "ceo-only") {
    throw new Error('notificationTarget must be "all-managers" or "ceo-only".');
  }

  return value;
}
