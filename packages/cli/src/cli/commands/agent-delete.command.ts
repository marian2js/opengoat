import type { CliCommand } from "../framework/command.js";

export const agentDeleteCommand: CliCommand = {
  path: ["agent", "delete"],
  description: "Delete an agent from OpenGoat and OpenClaw.",
  async run(args, context): Promise<number> {
    const parsed = parseAgentDeleteArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat agent delete <agent-id> [--force]\n");
      return 1;
    }

    if (parsed.help) {
      context.stdout.write("Usage: opengoat agent delete <agent-id> [--force]\n");
      return 0;
    }

    const result = await context.service.deleteAgent(parsed.agentId, {
      force: parsed.force
    });

    if (result.existed) {
      context.stdout.write(`Agent deleted: ${result.agentId}\n`);
    } else {
      context.stdout.write(`Agent not found: ${result.agentId}\n`);
    }
    if (result.runtimeSync) {
      context.stdout.write(`OpenClaw sync: ${result.runtimeSync.runtimeId} (code ${result.runtimeSync.code})\n`);
    }
    context.stdout.write(`Removed paths: ${result.removedPaths.length}\n`);
    return 0;
  }
};

interface ParsedDeleteArgs {
  ok: boolean;
  error?: string;
  help?: boolean;
  agentId: string;
  force: boolean;
}

function parseAgentDeleteArgs(args: string[]): ParsedDeleteArgs {
  let agentId = "";
  let force = false;

  for (const token of args) {
    if (!token) {
      continue;
    }

    if (token === "--help" || token === "-h") {
      return {
        ok: true,
        help: true,
        agentId: "",
        force: false
      };
    }

    if (token === "--force") {
      force = true;
      continue;
    }

    if (token.startsWith("--")) {
      return {
        ok: false,
        error: `Unknown option: ${token}`,
        agentId: "",
        force: false
      };
    }

    if (agentId) {
      return {
        ok: false,
        error: "Only one <agent-id> value is allowed.",
        agentId: "",
        force: false
      };
    }
    agentId = token.trim().toLowerCase();
  }

  if (!agentId) {
    return {
      ok: false,
      error: "Missing required <agent-id>.",
      agentId: "",
      force: false
    };
  }

  return {
    ok: true,
    agentId,
    force
  };
}
