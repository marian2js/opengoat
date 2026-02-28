import { normalizeAgentId, type TaskRecord } from "@opengoat/core";
import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

const MAX_TASK_LIST_RESULTS = 100;

export const taskCommand: CliCommand = {
  path: ["task"],
  description: "Manage tasks.",
  async run(args, context): Promise<number> {
    const command = args[0]?.trim().toLowerCase();

    if (!command || command === "--help" || command === "-h" || command === "help") {
      printHelp(context.stdout);
      return 0;
    }

    try {
      await context.service.initialize();

      if (command === "create") {
        const parsed = parseCreateArgs(args.slice(1));
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }

        const actorId = parsed.actorId ?? (await resolveCliDefaultAgentId(context));
        const task = await context.service.createTask(actorId, {
          title: parsed.title,
          description: parsed.description,
          assignedTo: parsed.assignedTo,
          status: parsed.status
        });

        context.stdout.write(`Task created: ${task.title} (${task.taskId})\n`);
        context.stdout.write(`Assigned to: ${task.assignedTo}\n`);
        context.stdout.write(`Status: ${task.status}\n`);
        return 0;
      }

      if (command === "cron") {
        const parsed = parseCronArgs(args.slice(1));
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }

        const runCycle = async (): Promise<number> => {
          const result = await context.service.runTaskCronCycle({
            inactiveMinutes: parsed.inactiveMinutes
          });
          context.stdout.write(
            `[task-cron] ran=${result.ranAt} scanned=${result.scannedTasks} todo=${result.todoTasks} blocked=${result.blockedTasks} inactive=${result.inactiveAgents} sent=${result.sent} failed=${result.failed}\n`
          );
          for (const dispatch of result.dispatches) {
            const state = dispatch.ok ? "ok" : "error";
            const subject = dispatch.taskId ? ` task=${dispatch.taskId}` : "";
            const error = dispatch.error ? ` error=${dispatch.error}` : "";
            context.stdout.write(
              `[task-cron] ${state} kind=${dispatch.kind} target=${dispatch.targetAgentId}${subject} session=${dispatch.sessionRef}${error}\n`
            );
          }
          return result.failed > 0 ? 1 : 0;
        };

        if (parsed.once) {
          return runCycle();
        }

        context.stdout.write(
          `[task-cron] started interval=${parsed.intervalMinutes}m inactive-threshold=${parsed.inactiveMinutes}m (Ctrl+C to stop)\n`
        );
        while (true) {
          await runCycle();
          await sleep(parsed.intervalMinutes * 60_000);
        }
      }

      if (command === "list") {
        const parsed = parseListArgs(args.slice(1));
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }

        let tasks = await context.service.listTasks({
          assignee: parsed.assignee,
          limit: MAX_TASK_LIST_RESULTS
        });
        tasks = sortTasksByLatest(tasks);

        if (parsed.json) {
          context.stdout.write(`${JSON.stringify(tasks, null, 2)}\n`);
          return 0;
        }

        if (tasks.length === 0) {
          context.stdout.write("No tasks found.\n");
          return 0;
        }

        for (const task of tasks) {
          context.stdout.write(`${task.taskId}\t${task.title}\t[${task.status}]\tassigned=${task.assignedTo}\n`);
        }
        return 0;
      }

      if (command === "show") {
        const taskId = args[1]?.trim();
        if (!taskId) {
          context.stderr.write("Missing <task-id>.\n");
          printHelp(context.stderr);
          return 1;
        }
        const json = args.slice(2).includes("--json");
        const task = await context.service.getTask(taskId);
        if (json) {
          context.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
          return 0;
        }

        context.stdout.write(`Task: ${task.title} (${task.taskId})\n`);
        context.stdout.write(`Owner: ${task.owner}\n`);
        context.stdout.write(`Assigned to: ${task.assignedTo}\n`);
        context.stdout.write(`Status: ${task.status}\n`);
        context.stdout.write(`Description: ${task.description}\n`);
        context.stdout.write(`Blockers: ${task.blockers.length}\n`);
        context.stdout.write(`Artifacts: ${task.artifacts.length}\n`);
        context.stdout.write(`Worklog entries: ${task.worklog.length}\n`);
        return 0;
      }

      if (command === "status") {
        const parsed = parseStatusArgs(args.slice(1));
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }
        const actorId = parsed.actorId ?? (await resolveCliDefaultAgentId(context));
        const task = await context.service.updateTaskStatus(actorId, parsed.taskId, parsed.status, parsed.reason);
        context.stdout.write(`Task updated: ${task.taskId}\n`);
        context.stdout.write(`Status: ${task.status}\n`);
        if (task.statusReason) {
          context.stdout.write(`Reason: ${task.statusReason}\n`);
        }
        return 0;
      }

      if (command === "blocker") {
        const parsed = parseEntryArgs(args.slice(1), "blocker");
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }
        const actorId = parsed.actorId ?? (await resolveCliDefaultAgentId(context));
        const task = await context.service.addTaskBlocker(actorId, parsed.taskId, parsed.content);
        context.stdout.write(`Task updated: ${task.taskId}\n`);
        context.stdout.write(`Blockers: ${task.blockers.length}\n`);
        return 0;
      }

      if (command === "artifact") {
        const parsed = parseEntryArgs(args.slice(1), "artifact");
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }
        const actorId = parsed.actorId ?? (await resolveCliDefaultAgentId(context));
        const task = await context.service.addTaskArtifact(actorId, parsed.taskId, parsed.content);
        context.stdout.write(`Task updated: ${task.taskId}\n`);
        context.stdout.write(`Artifacts: ${task.artifacts.length}\n`);
        return 0;
      }

      if (command === "worklog") {
        const parsed = parseEntryArgs(args.slice(1), "worklog");
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }
        const actorId = parsed.actorId ?? (await resolveCliDefaultAgentId(context));
        const task = await context.service.addTaskWorklog(actorId, parsed.taskId, parsed.content);
        context.stdout.write(`Task updated: ${task.taskId}\n`);
        context.stdout.write(`Worklog entries: ${task.worklog.length}\n`);
        return 0;
      }

      context.stderr.write(`Unknown task command: ${command}\n`);
      printHelp(context.stderr);
      return 1;
    } catch (error) {
      context.stderr.write(`${toErrorMessage(error)}\n`);
      return 1;
    }
  }
};

interface TaskCreateArgsOk {
  ok: true;
  actorId?: string;
  title: string;
  description: string;
  assignedTo?: string;
  status?: string;
}

interface TaskStatusArgsOk {
  ok: true;
  actorId?: string;
  taskId: string;
  status: string;
  reason?: string;
}

interface TaskEntryArgsOk {
  ok: true;
  actorId?: string;
  taskId: string;
  content: string;
}

interface TaskCronArgsOk {
  ok: true;
  once: boolean;
  intervalMinutes: number;
  inactiveMinutes: number;
}

interface TaskListArgsOk {
  ok: true;
  assignee?: string;
  json: boolean;
}

type ParseCreateResult = { ok: false; error: string } | TaskCreateArgsOk;
type ParseStatusResult = { ok: false; error: string } | TaskStatusArgsOk;
type ParseEntryResult = { ok: false; error: string } | TaskEntryArgsOk;
type ParseCronResult = { ok: false; error: string } | TaskCronArgsOk;
type ParseListResult = { ok: false; error: string } | TaskListArgsOk;

function parseCreateArgs(args: string[]): ParseCreateResult {
  let actorId: string | undefined;
  let title: string | undefined;
  let description: string | undefined;
  let assignedTo: string | undefined;
  let status: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--owner") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --owner." };
      }
      actorId = value;
      index += 1;
      continue;
    }

    if (token === "--title") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --title." };
      }
      title = value;
      index += 1;
      continue;
    }

    if (token === "--description") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --description." };
      }
      description = value;
      index += 1;
      continue;
    }

    if (token === "--assign") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --assign." };
      }
      assignedTo = value;
      index += 1;
      continue;
    }

    if (token === "--status") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --status." };
      }
      status = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (!title) {
    return { ok: false, error: "Missing required --title." };
  }
  if (!description) {
    return { ok: false, error: "Missing required --description." };
  }

  return {
    ok: true,
    actorId,
    title,
    description,
    assignedTo,
    status
  };
}

function parseStatusArgs(args: string[]): ParseStatusResult {
  const taskId = args[0]?.trim();
  const status = args[1]?.trim();
  if (!taskId || !status) {
    return {
      ok: false,
      error: "Usage: opengoat task status <task-id> <status> [--reason <text>] [--as <agent-id>]"
    };
  }

  let actorId: string | undefined;
  let reason: string | undefined;
  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--as") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --as." };
      }
      actorId = value;
      index += 1;
      continue;
    }
    if (token === "--reason") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --reason." };
      }
      reason = value;
      index += 1;
      continue;
    }
    return { ok: false, error: `Unknown option: ${token}` };
  }

  const normalizedStatus = status.toLowerCase();
  if ((normalizedStatus === "pending" || normalizedStatus === "blocked") && !reason) {
    return { ok: false, error: `--reason is required when status is ${normalizedStatus}.` };
  }

  return {
    ok: true,
    actorId,
    taskId,
    status,
    reason
  };
}

function parseEntryArgs(args: string[], kind: "blocker" | "artifact" | "worklog"): ParseEntryResult {
  const action = args[0]?.trim().toLowerCase();
  if (action !== "add") {
    return { ok: false, error: `Usage: opengoat task ${kind} add <task-id> <content> [--as <agent-id>]` };
  }

  const taskId = args[1]?.trim();
  if (!taskId) {
    return { ok: false, error: "Missing <task-id>." };
  }

  let actorId: string | undefined;
  const contentParts: string[] = [];

  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "--as") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --as." };
      }
      actorId = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--")) {
      return { ok: false, error: `Unknown option: ${token}` };
    }

    contentParts.push(token);
  }

  const content = contentParts.join(" ").trim();
  if (!content) {
    return { ok: false, error: `Missing ${kind} content.` };
  }

  return {
    ok: true,
    actorId,
    taskId,
    content
  };
}

function parseCronArgs(args: string[]): ParseCronResult {
  let once = false;
  let intervalMinutes = 5;
  let inactiveMinutes = 30;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--once") {
      once = true;
      continue;
    }

    if (token === "--interval-minutes") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --interval-minutes." };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: "--interval-minutes must be a positive integer." };
      }
      intervalMinutes = parsed;
      index += 1;
      continue;
    }

    if (token === "--inactive-minutes") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --inactive-minutes." };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: "--inactive-minutes must be a positive integer." };
      }
      inactiveMinutes = parsed;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    once,
    intervalMinutes,
    inactiveMinutes
  };
}

function parseListArgs(args: string[]): ParseListResult {
  let assignee: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]?.trim();
    if (!token) {
      continue;
    }

    if (token === "--json") {
      json = true;
      continue;
    }

    if (token === "--as") {
      const value = args[index + 1]?.trim();
      const normalizedAssignee = normalizeAgentId(value || "");
      if (!normalizedAssignee) {
        return { ok: false, error: "Missing value for --as." };
      }
      assignee = normalizedAssignee;
      index += 1;
      continue;
    }

    if (token.startsWith("--")) {
      return { ok: false, error: `Unknown option: ${token}` };
    }
    return { ok: false, error: `Unexpected argument: ${token}` };
  }

  return {
    ok: true,
    assignee,
    json
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat task create --title <title> --description <text> [--owner <agent-id>] [--assign <agent-id>] [--status <todo|doing|pending|blocked|done>]\n"
  );
  output.write("  opengoat task list [--as <agent-id>] [--json]\n");
  output.write("  opengoat task show <task-id> [--json]\n");
  output.write("  opengoat task status <task-id> <todo|doing|pending|blocked|done> [--reason <text>] [--as <agent-id>]\n");
  output.write("  opengoat task blocker add <task-id> <content> [--as <agent-id>]\n");
  output.write("  opengoat task artifact add <task-id> <content> [--as <agent-id>]\n");
  output.write("  opengoat task worklog add <task-id> <content> [--as <agent-id>]\n");
  output.write("  opengoat task cron [--once] [--interval-minutes <n>] [--inactive-minutes <n>]\n");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sortTasksByLatest(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((left, right) => {
    const createdAtComparison = right.createdAt.localeCompare(left.createdAt);
    if (createdAtComparison !== 0) {
      return createdAtComparison;
    }
    return right.taskId.localeCompare(left.taskId);
  });
}
