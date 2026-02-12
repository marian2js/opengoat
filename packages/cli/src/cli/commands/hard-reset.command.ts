import type { CliCommand } from "../framework/command.js";
import { createCliPrompter, PromptCancelledError } from "../framework/prompter.js";

export const hardResetCommand: CliCommand = {
  path: ["hard-reset"],
  description:
    "Delete OpenGoat home and OpenClaw state associated with OpenGoat agents.",
  async run(args, context): Promise<number> {
    const parsed = parseHardResetArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    if (!parsed.yes) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        context.stderr.write(
          "Confirmation required in non-interactive mode. Re-run with --yes.\n",
        );
        return 1;
      }

      const prompter = createCliPrompter({
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      });

      try {
        const confirmed = await prompter.confirm({
          message:
            "Hard reset will permanently delete OpenGoat home and OpenClaw state linked to OpenGoat. Continue?",
          initialValue: false,
        });
        if (!confirmed) {
          context.stdout.write("Hard reset cancelled.\n");
          return 0;
        }
      } catch (error) {
        if (error instanceof PromptCancelledError) {
          return 0;
        }
        throw error;
      }
    }

    const result = await context.service.hardReset();
    context.stdout.write("Hard reset completed.\n");
    context.stdout.write(`OpenGoat home: ${result.homeDir}\n`);
    context.stdout.write(
      `Home removed: ${result.homeRemoved ? "yes" : "no"}\n`,
    );
    context.stdout.write(
      `OpenClaw agents removed: ${result.deletedOpenClawAgents.length}\n`,
    );
    for (const agentId of result.deletedOpenClawAgents) {
      context.stdout.write(`  - ${agentId}\n`);
    }
    context.stdout.write(
      `OpenClaw managed role-skill dirs removed: ${result.removedOpenClawManagedSkillDirs.length}\n`,
    );
    for (const skillDir of result.removedOpenClawManagedSkillDirs) {
      context.stdout.write(`  - ${skillDir}\n`);
    }

    for (const warning of result.warnings) {
      context.stderr.write(`Warning: ${warning}\n`);
    }

    for (const failure of result.failedOpenClawAgents) {
      context.stderr.write(
        `Failed to remove OpenClaw agent "${failure.agentId}": ${failure.reason}\n`,
      );
    }

    return result.failedOpenClawAgents.length > 0 ? 1 : 0;
  },
};

type ParsedHardResetArgs =
  | {
      ok: true;
      help: boolean;
      yes: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseHardResetArgs(args: string[]): ParsedHardResetArgs {
  let help = false;
  let yes = false;

  for (const token of args) {
    if (!token) {
      continue;
    }
    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }
    if (token === "--yes" || token === "-y") {
      yes = true;
      continue;
    }
    return {
      ok: false,
      error: `Unknown option: ${token}`,
    };
  }

  return {
    ok: true,
    help,
    yes,
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat hard-reset [--yes]\n");
  output.write("\n");
  output.write("Description:\n");
  output.write(
    "  Deletes OpenGoat home and cleans OpenClaw agents/role-skills associated with OpenGoat.\n",
  );
}
