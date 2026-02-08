import type { CliCommand } from "../framework/command.js";

export const agentDeleteCommand: CliCommand = {
  path: ["agent", "delete"],
  description: "Delete an agent workspace and internal config.",
  async run(args, context): Promise<number> {
    const parsed = parseAgentDeleteArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat agent delete <agent-id> [--provider <id>] [--delete-external]\n");
      return 1;
    }

    if (parsed.help) {
      context.stdout.write("Usage: opengoat agent delete <agent-id> [--provider <id>] [--delete-external]\n");
      context.stdout.write("\n");
      context.stdout.write("Options:\n");
      context.stdout.write("  --provider <id>       Provider id to use for external deletion.\n");
      context.stdout.write("  --delete-external     Also delete provider-side agent (if supported).\n");
      return 0;
    }

    const result = await context.service.deleteAgent(parsed.agentId, {
      providerId: parsed.providerId,
      deleteExternalAgent: parsed.deleteExternal
    });

    if (result.existed) {
      context.stdout.write(`Agent deleted locally: ${result.agentId}\n`);
    } else {
      context.stdout.write(`Agent not found locally: ${result.agentId}\n`);
    }
    context.stdout.write(`Removed paths: ${result.removedPaths.length}\n`);

    if (result.externalAgentDeletion) {
      context.stdout.write(
        `External agent deletion (${result.externalAgentDeletion.providerId}): code ${result.externalAgentDeletion.code}\n`
      );
      if (result.externalAgentDeletion.stdout.trim()) {
        context.stdout.write(result.externalAgentDeletion.stdout);
        if (!result.externalAgentDeletion.stdout.endsWith("\n")) {
          context.stdout.write("\n");
        }
      }
      if (result.externalAgentDeletion.stderr.trim()) {
        context.stderr.write(result.externalAgentDeletion.stderr);
        if (!result.externalAgentDeletion.stderr.endsWith("\n")) {
          context.stderr.write("\n");
        }
      }

      if (result.externalAgentDeletion.code !== 0) {
        context.stderr.write("Local agent was deleted, but external provider agent deletion failed.\n");
        return result.externalAgentDeletion.code;
      }
    }

    return 0;
  }
};

interface ParsedDeleteArgs {
  ok: boolean;
  error?: string;
  help?: boolean;
  agentId: string;
  providerId?: string;
  deleteExternal: boolean;
}

function parseAgentDeleteArgs(args: string[]): ParsedDeleteArgs {
  let agentId = "";
  let providerId: string | undefined;
  let deleteExternal = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "--help" || token === "-h") {
      return {
        ok: true,
        help: true,
        agentId: "",
        deleteExternal: false
      };
    }

    if (token === "--delete-external") {
      deleteExternal = true;
      continue;
    }

    if (token === "--provider") {
      const value = args[index + 1]?.trim();
      if (!value || value.startsWith("--")) {
        return {
          ok: false,
          error: "Missing value for --provider.",
          agentId: "",
          deleteExternal: false
        };
      }
      providerId = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--provider=")) {
      const value = token.slice("--provider=".length).trim();
      if (!value) {
        return {
          ok: false,
          error: "Missing value for --provider.",
          agentId: "",
          deleteExternal: false
        };
      }
      providerId = value;
      continue;
    }

    if (token.startsWith("--")) {
      return {
        ok: false,
        error: `Unknown option: ${token}`,
        agentId: "",
        deleteExternal: false
      };
    }

    if (agentId) {
      return {
        ok: false,
        error: "Only one <agent-id> value is allowed.",
        agentId: "",
        deleteExternal: false
      };
    }
    agentId = token.trim().toLowerCase();
  }

  if (!agentId) {
    return {
      ok: false,
      error: "Missing required <agent-id>.",
      agentId: "",
      deleteExternal: false
    };
  }

  return {
    ok: true,
    agentId,
    providerId,
    deleteExternal
  };
}
