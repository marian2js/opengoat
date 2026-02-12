import { DEFAULT_AGENT_ID, normalizeAgentId } from "@opengoat/core";
import type { CliCommand } from "../framework/command.js";

export const boardCommand: CliCommand = {
  path: ["board"],
  description: "Manage organization boards (kanban).",
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
        const board = await context.service.createBoard(parsed.actorId, {
          title: parsed.title
        });
        context.stdout.write(`Board created: ${board.title} (${board.boardId})\n`);
        context.stdout.write(`Owner: ${board.owner}\n`);
        return 0;
      }

      if (command === "list") {
        const parsed = parseListArgs(args.slice(1));
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }

        const boards = await context.service.listBoards();
        const filtered = parsed.owner ? boards.filter((board) => board.owner === parsed.owner) : boards;
        if (parsed.json) {
          context.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
          return 0;
        }
        if (filtered.length === 0) {
          context.stdout.write("No boards found.\n");
          return 0;
        }
        for (const board of filtered) {
          context.stdout.write(`${board.boardId}\t${board.title}\towner=${board.owner}\n`);
        }
        return 0;
      }

      if (command === "show") {
        const boardId = args[1]?.trim();
        if (!boardId) {
          context.stderr.write("Missing <board-id>.\n");
          printHelp(context.stderr);
          return 1;
        }
        const json = args.slice(2).includes("--json");
        const board = await context.service.getBoard(boardId);
        if (json) {
          context.stdout.write(`${JSON.stringify(board, null, 2)}\n`);
          return 0;
        }

        context.stdout.write(`Board: ${board.title} (${board.boardId})\n`);
        context.stdout.write(`Owner: ${board.owner}\n`);
        context.stdout.write(`Created: ${board.createdAt}\n`);
        context.stdout.write(`Tasks: ${board.tasks.length}\n`);
        for (const task of board.tasks) {
          context.stdout.write(
            `- ${task.taskId}: ${task.title} [${task.status}] project=${task.project} -> ${task.assignedTo}\n`
          );
        }
        return 0;
      }

      if (command === "update") {
        const parsed = parseUpdateArgs(args.slice(1));
        if (!parsed.ok) {
          context.stderr.write(`${parsed.error}\n`);
          printHelp(context.stderr);
          return 1;
        }
        const board = await context.service.updateBoard(parsed.actorId, parsed.boardId, {
          title: parsed.title
        });
        context.stdout.write(`Board updated: ${board.title} (${board.boardId})\n`);
        return 0;
      }

      context.stderr.write(`Unknown board command: ${command}\n`);
      printHelp(context.stderr);
      return 1;
    } catch (error) {
      context.stderr.write(`${toErrorMessage(error)}\n`);
      return 1;
    }
  }
};

interface CreateArgsOk {
  ok: true;
  actorId: string;
  title: string;
}

interface ListArgsOk {
  ok: true;
  json: boolean;
  owner?: string;
}

interface UpdateArgsOk {
  ok: true;
  actorId: string;
  boardId: string;
  title?: string;
}

type ParseResult = { ok: false; error: string } | CreateArgsOk;
type ParseListResult = { ok: false; error: string } | ListArgsOk;
type ParseUpdateResult = { ok: false; error: string } | UpdateArgsOk;

function parseCreateArgs(args: string[]): ParseResult {
  let actorId = DEFAULT_AGENT_ID;
  const titleParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "--owner") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --owner." };
      }
      actorId = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--")) {
      return { ok: false, error: `Unknown option: ${token}` };
    }

    titleParts.push(token);
  }

  const title = titleParts.join(" ").trim();
  if (!title) {
    return { ok: false, error: "Missing required <title>." };
  }

  return {
    ok: true,
    actorId,
    title
  };
}

function parseListArgs(args: string[]): ParseListResult {
  let json = false;
  let owner: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]?.trim();
    if (!token) {
      continue;
    }

    if (token === "--json") {
      json = true;
      continue;
    }

    if (token === "--owner") {
      const value = args[index + 1]?.trim();
      const normalized = normalizeAgentId(value || "");
      if (!normalized) {
        return { ok: false, error: "Missing value for --owner." };
      }
      owner = normalized;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    json,
    owner
  };
}

function parseUpdateArgs(args: string[]): ParseUpdateResult {
  const boardId = args[0]?.trim();
  if (!boardId) {
    return { ok: false, error: "Missing required <board-id>." };
  }

  let actorId = DEFAULT_AGENT_ID;
  let title: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
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

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (!title) {
    return { ok: false, error: "Specify --title." };
  }

  return {
    ok: true,
    actorId,
    boardId,
    title
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat board create <title> [--owner <agent-id>]\n");
  output.write("  opengoat board list [--owner <agent-id>] [--json]\n");
  output.write("  opengoat board show <board-id> [--json]\n");
  output.write("  opengoat board update <board-id> [--owner <agent-id>] --title <title>\n");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
