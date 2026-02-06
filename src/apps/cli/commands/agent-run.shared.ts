import type { CliContext } from "../framework/command.js";

export interface AgentRunRequest {
  agentId: string;
  message: string;
  model?: string;
  passthroughArgs: string[];
  stream: boolean;
}

export async function executeAgentRun(request: AgentRunRequest, context: CliContext): Promise<number> {
  const stdoutBuffer: string[] = [];
  const stderrBuffer: string[] = [];

  let result;
  try {
    result = await context.service.runAgent(request.agentId, {
      message: request.message,
      model: request.model,
      passthroughArgs: request.passthroughArgs,
      env: process.env,
      onStdout: request.stream
        ? (chunk) => {
            context.stdout.write(chunk);
          }
        : (chunk) => {
            stdoutBuffer.push(chunk);
          },
      onStderr: request.stream
        ? (chunk) => {
            context.stderr.write(chunk);
          }
        : (chunk) => {
            stderrBuffer.push(chunk);
          }
    });
  } catch (error) {
    context.stderr.write(`Failed to run ${request.agentId}: ${formatError(error)}\n`);
    return 1;
  }

  if (!request.stream) {
    const stdout = stdoutBuffer.join("") || result.stdout;
    const stderr = stderrBuffer.join("") || result.stderr;
    if (stdout) {
      context.stdout.write(stdout);
    }
    if (stderr) {
      context.stderr.write(stderr);
    }
  }

  if (result.code !== 0) {
    context.stderr.write(`Provider run failed for ${result.agentId} (${result.providerId}).\n`);
    return result.code;
  }

  return 0;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
