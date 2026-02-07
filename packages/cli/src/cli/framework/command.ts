import type { OpenGoatService } from "@opengoat/core";

export interface CliContext {
  service: OpenGoatService;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

export interface CliCommand {
  path: string[];
  description: string;
  run(args: string[], context: CliContext): Promise<number>;
}
