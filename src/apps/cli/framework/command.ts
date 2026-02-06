import type { OpenGoatService } from "../../../core/services/opengoat.service.js";

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
