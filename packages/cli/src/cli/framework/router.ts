import type { CliCommand, CliContext } from "./command.js";

export class CommandRouter {
  private readonly commands: CliCommand[];
  private readonly context: CliContext;

  public constructor(commands: CliCommand[], context: CliContext) {
    this.commands = [...commands].sort((left, right) => right.path.length - left.path.length);
    this.context = context;
  }

  public async dispatch(argv: string[]): Promise<number> {
    if (argv.length === 0) {
      this.printHelp();
      return 0;
    }

    if (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
      this.printHelp();
      return 0;
    }

    const match = this.commands.find((command) => isPathMatch(argv, command.path));
    if (!match) {
      this.context.stderr.write(`Unknown command: ${argv.join(" ")}\n\n`);
      this.printHelp();
      return 1;
    }

    const remainingArgs = argv.slice(match.path.length);
    return match.run(remainingArgs, this.context);
  }

  public printHelp(): void {
    this.context.stdout.write("OpenGoat CLI\n\n");
    this.context.stdout.write("Usage:\n");
    this.context.stdout.write("  opengoat [command]\n\n");
    this.context.stdout.write("Commands:\n");

    const sorted = [...this.commands].sort((left, right) => {
      const leftPath = left.path.join(" ");
      const rightPath = right.path.join(" ");
      return leftPath.localeCompare(rightPath);
    });

    for (const command of sorted) {
      const path = command.path.join(" ");
      const paddedPath = path.padEnd(20, " ");
      const separator = paddedPath.endsWith(" ") ? "" : " ";
      this.context.stdout.write(`  ${paddedPath}${separator}${command.description}\n`);
    }
  }
}

function isPathMatch(argv: string[], path: string[]): boolean {
  if (argv.length < path.length) {
    return false;
  }

  return path.every((segment, index) => argv[index] === segment);
}
