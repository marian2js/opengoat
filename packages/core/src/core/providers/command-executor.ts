import { spawn } from "node:child_process";
import type { ProviderExecutionResult } from "./types.js";

interface ExecuteCommandOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export function executeCommand(options: ExecuteCommandOptions): Promise<ProviderExecutionResult> {
  return new Promise((resolve, reject) => {
    if (options.abortSignal?.aborted) {
      reject(createAbortError());
      return;
    }

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options.onStderr?.(text);
    });

    let settled = false;
    const finishWithError = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const finishWithResult = (code: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({
        code: code ?? 1,
        stdout,
        stderr
      });
    };
    const cleanup = () => {
      options.abortSignal?.removeEventListener("abort", handleAbort);
    };
    const handleAbort = () => {
      terminateProcess(child);
      finishWithError(createAbortError());
    };

    options.abortSignal?.addEventListener("abort", handleAbort, { once: true });
    child.on("error", (error) =>
      finishWithError(error instanceof Error ? error : new Error(String(error)))
    );
    child.on("close", (code) => {
      finishWithResult(code);
    });
  });
}

function terminateProcess(child: ReturnType<typeof spawn>): void {
  if (child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // ignore termination errors
  }
}

function createAbortError(): Error {
  const error = new Error("Command execution aborted.");
  error.name = "AbortError";
  return error;
}
