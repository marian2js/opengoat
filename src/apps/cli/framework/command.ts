import type { OpenGoatService } from "../../../core/opengoat/index.js";

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
