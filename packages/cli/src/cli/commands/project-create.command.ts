import type { CliCommand } from "../framework/command.js";

export const projectCreateCommand: CliCommand = {
  path: ["project", "create"],
  description: "Create a project from a URL and provision its CMO OpenClaw agent.",
  async run(args, context): Promise<number> {
    const parsed = parseProjectCreateArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    const result = await context.service.createProject(parsed.url);
    context.stdout.write(
      `Project ready: ${result.project.displayName} (${result.project.id})\n`,
    );
    context.stdout.write(`Source URL: ${result.project.sourceUrl}\n`);
    context.stdout.write(`CMO agent: ${result.project.cmoAgent.id}\n`);
    context.stdout.write(
      `Workspace: ${result.project.cmoAgent.workspaceDir}\n`,
    );
    context.stdout.write(
      `Internal config: ${result.project.cmoAgent.internalConfigDir}\n`,
    );
    if (result.alreadyExisted) {
      context.stdout.write(
        "Project already existed; OpenClaw sync was still attempted.\n",
      );
    }
    if (result.runtimeSync) {
      context.stdout.write(
        `OpenClaw sync: ${result.runtimeSync.runtimeId} (code ${result.runtimeSync.code})\n`,
      );
    }
    return 0;
  },
};

type ParsedProjectCreateArgs =
  | {
      ok: true;
      help?: boolean;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

function parseProjectCreateArgs(args: string[]): ParsedProjectCreateArgs {
  if (args.length === 0) {
    return {
      ok: false,
      error: "Missing required <url>.",
    };
  }

  if (args[0] === "--help" || args[0] === "-h") {
    return {
      ok: true,
      help: true,
      url: "",
    };
  }

  const [url, ...rest] = args;
  if (!url?.trim()) {
    return {
      ok: false,
      error: "Missing required <url>.",
    };
  }
  if (rest.some((token) => token.startsWith("--"))) {
    return {
      ok: false,
      error: `Unknown option: ${rest.find((token) => token.startsWith("--"))}`,
    };
  }
  if (rest.length > 0) {
    return {
      ok: false,
      error: `Unexpected argument: ${rest[0]}`,
    };
  }

  return {
    ok: true,
    url: url.trim(),
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage: opengoat project create <url>\n");
  output.write(
    "Creates ~/.opengoat/projects/<project>/cmo and provisions a matching OpenClaw CMO agent.\n",
  );
}
