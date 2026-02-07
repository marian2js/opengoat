export interface CommandRunRequest {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CommandRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunnerPort {
  run(request: CommandRunRequest): Promise<CommandRunResult>;
}
