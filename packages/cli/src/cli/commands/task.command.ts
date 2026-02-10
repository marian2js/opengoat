import { DEFAULT_AGENT_ID } from "@opengoat/core";
import type { CliCommand } from "../framework/command.js";

export const taskCommand: CliCommand = {
  path: ["task"],
  description: "Manage board tasks.",
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

        const task = await context.service.createTask(parsed.actorId, parsed.boardId, {
          title: parsed.title,
          description: parsed.description,
          assignedTo: parsed.assignedTo,
          status: parsed.status
        });

        context.stdout.write(`Task created: ${task.title} (${task.taskId})\n`);
        context.stdout.write(`Board: ${task.boardId}\n`);
        context.stdout.write(`Assigned to: ${task.assignedTo}\n`);
        context.stdout.write(`Status: ${task.status}\n`);
        return 0;
      }

      if (command === "list") {
        const boardId = args[1]?.trim();
        if (!boardId) {
          context.stderr.write("Missing <board-id>.\n");
          printHelp(context.stderr);
          return 1;
        }
        const json = args.slice(2).includes("--json");
        const tasks = await context.service.listTasks(boardId);

        if (json) {
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
        context.stdout.write(`Board: ${task.boardId}\n`);
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
        const task = await context.service.updateTaskStatus(parsed.actorId, parsed.taskId, parsed.status);
        context.stdout.write(`Task updated: ${task.taskId}\n`);
        context.stdout.write(`Status: ${task.status}\n`);
        return 0;
      }

      if (command === "blocker") {
        const parsed = parseEntryArgs(args.slice(1), "blocker");
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }
        const task = await context.service.addTaskBlocker(parsed.actorId, parsed.taskId, parsed.content);
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
        const task = await context.service.addTaskArtifact(parsed.actorId, parsed.taskId, parsed.content);
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
        const task = await context.service.addTaskWorklog(parsed.actorId, parsed.taskId, parsed.content);
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
  actorId: string;
  boardId: string;
  title: string;
  description: string;
  assignedTo?: string;
  status?: string;
}

interface TaskStatusArgsOk {
  ok: true;
  actorId: string;
  taskId: string;
  status: string;
}

interface TaskEntryArgsOk {
  ok: true;
  actorId: string;
  taskId: string;
  content: string;
}

type ParseCreateResult = { ok: false; error: string } | TaskCreateArgsOk;
type ParseStatusResult = { ok: false; error: string } | TaskStatusArgsOk;
type ParseEntryResult = { ok: false; error: string } | TaskEntryArgsOk;

function parseCreateArgs(args: string[]): ParseCreateResult {
  const boardId = args[0]?.trim();
  if (!boardId) {
    return { ok: false, error: "Missing <board-id>." };
  }

  let actorId = DEFAULT_AGENT_ID;
  let title: string | undefined;
  let description: string | undefined;
  let assignedTo: string | undefined;
  let status: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
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
    boardId,
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
    return { ok: false, error: "Usage: opengoat task status <task-id> <status> [--as <agent-id>]" };
  }

  let actorId = DEFAULT_AGENT_ID;
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
    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    actorId,
    taskId,
    status
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

  let actorId = DEFAULT_AGENT_ID;
  const contentParts: string[] = [];

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

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat task create <board-id> --title <title> --description <text> [--as <agent-id>] [--assign <agent-id>] [--status <todo|doing|done>]\n"
  );
  output.write("  opengoat task list <board-id> [--json]\n");
  output.write("  opengoat task show <task-id> [--json]\n");
  output.write("  opengoat task status <task-id> <todo|doing|done> [--as <agent-id>]\n");
  output.write("  opengoat task blocker add <task-id> <content> [--as <agent-id>]\n");
  output.write("  opengoat task artifact add <task-id> <content> [--as <agent-id>]\n");
  output.write("  opengoat task worklog add <task-id> <content> [--as <agent-id>]\n");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
