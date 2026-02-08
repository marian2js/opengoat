import type { CliCommand } from "../framework/command.js";

export const agentCreateCommand: CliCommand = {
  path: ["agent", "create"],
  description: "Create an agent workspace and internal config (Markdown + JSON).",
  async run(args, context): Promise<number> {
    if (args.includes("--set-default")) {
      context.stderr.write("`--set-default` is not supported. Orchestrator is always the default agent.\n");
      return 1;
    }

    const parsed = parseAgentCreateArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write(
        "Usage: opengoat agent create <name> [--provider <id>] [--create-external | --no-create-external]\n"
      );
      return 1;
    }

    if (parsed.help) {
      context.stdout.write(
        "Usage: opengoat agent create <name> [--provider <id>] [--create-external | --no-create-external]\n"
      );
      context.stdout.write("\n");
      context.stdout.write("Options:\n");
      context.stdout.write("  --provider <id>       Set the agent provider after creation.\n");
      context.stdout.write(
        "  --create-external     Force provider-side creation when supported.\n"
      );
      context.stdout.write(
        "  --no-create-external  Disable provider-side creation (enabled by default when supported).\n"
      );
      return 0;
    }

    const name = parsed.name;

    if (!name) {
      context.stderr.write("Usage: opengoat agent create <name>\n");
      return 1;
    }

    const result = await context.service.createAgent(name, {
      providerId: parsed.providerId,
      createExternalAgent: parsed.createExternal
    });

    context.stdout.write(`Agent created: ${result.agent.displayName} (${result.agent.id})\n`);
    context.stdout.write(`Workspace: ${result.agent.workspaceDir}\n`);
    context.stdout.write(`Internal config: ${result.agent.internalConfigDir}\n`);
    context.stdout.write(`Created: ${result.createdPaths.length} path(s)\n`);
    if (parsed.providerId) {
      context.stdout.write(`Provider: ${parsed.providerId}\n`);
    }

    if (result.externalAgentCreation) {
      context.stdout.write(
        `External agent creation (${result.externalAgentCreation.providerId}): code ${result.externalAgentCreation.code}\n`
      );
      if (result.externalAgentCreation.stdout.trim()) {
        context.stdout.write(result.externalAgentCreation.stdout);
        if (!result.externalAgentCreation.stdout.endsWith("\n")) {
          context.stdout.write("\n");
        }
      }
      if (result.externalAgentCreation.stderr.trim()) {
        context.stderr.write(result.externalAgentCreation.stderr);
        if (!result.externalAgentCreation.stderr.endsWith("\n")) {
          context.stderr.write("\n");
        }
      }

      if (result.externalAgentCreation.code !== 0) {
        context.stderr.write("Local agent was created, but external provider agent creation failed.\n");
        return result.externalAgentCreation.code;
      }
    }

    return 0;
  }
};

interface ParsedAgentCreateArgs {
  ok: boolean;
  error?: string;
  help?: boolean;
  name: string;
  providerId?: string;
  createExternal?: boolean;
}

function parseAgentCreateArgs(args: string[]): ParsedAgentCreateArgs {
  const nameParts: string[] = [];
  let providerId: string | undefined;
  let createExternal: boolean | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "--help" || token === "-h") {
      return {
        ok: true,
        help: true,
        name: "",
        createExternal: undefined
      };
    }

    if (token === "--create-external") {
      if (createExternal === false) {
        return {
          ok: false,
          error: "Cannot combine --create-external with --no-create-external.",
          name: "",
          createExternal: undefined
        };
      }
      createExternal = true;
      continue;
    }

    if (token === "--no-create-external") {
      if (createExternal === true) {
        return {
          ok: false,
          error: "Cannot combine --create-external with --no-create-external.",
          name: "",
          createExternal: undefined
        };
      }
      createExternal = false;
      continue;
    }

    if (token === "--provider") {
      const value = args[index + 1]?.trim();
      if (!value || value.startsWith("--")) {
        return {
          ok: false,
          error: "Missing value for --provider.",
          name: "",
          createExternal: undefined
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
          name: "",
          createExternal: undefined
        };
      }
      providerId = value;
      continue;
    }

    if (token.startsWith("--")) {
      return {
        ok: false,
        error: `Unknown option: ${token}`,
        name: "",
        createExternal: undefined
      };
    }

    nameParts.push(token);
  }

  return {
    ok: true,
    name: nameParts.join(" ").trim(),
    providerId,
    createExternal
  };
}
