import { spawn, type ChildProcess } from "node:child_process";

export interface OpenGoatRunRequest {
  command: string;
  args: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface OpenGoatRunResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
}

export type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env: NodeJS.ProcessEnv;
    stdio: "inherit";
  },
) => ChildProcess;

const defaultSpawnProcess: SpawnProcess = (command, args, options) =>
  spawn(command, [...args], options);

export async function runOpenGoatProcess(
  request: OpenGoatRunRequest,
  spawnProcess: SpawnProcess = defaultSpawnProcess,
): Promise<OpenGoatRunResult> {
  return new Promise<OpenGoatRunResult>((resolve, reject) => {
    const child = spawnProcess(request.command, request.args, {
      stdio: "inherit",
      cwd: request.cwd,
      env: {
        ...process.env,
        ...request.env,
      },
    });

    child.once("error", (error) => {
      const errorWithCode = error as NodeJS.ErrnoException;
      if (errorWithCode.code === "ENOENT") {
        reject(new Error(`OpenGoat command not found: ${request.command}`));
        return;
      }
      reject(error);
    });

    child.once("exit", (exitCode, signal) => {
      resolve({
        exitCode: exitCode ?? 1,
        signal,
      });
    });
  });
}
