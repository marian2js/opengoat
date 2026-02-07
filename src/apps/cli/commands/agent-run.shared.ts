import type { CliContext } from "../framework/command.js";

export interface AgentRunRequest {
  agentId: string;
  message: string;
  model?: string;
  cwd?: string;
  sessionRef?: string;
  forceNewSession?: boolean;
  disableSession?: boolean;
  passthroughArgs: string[];
  stream: boolean;
}

export async function executeAgentRun(request: AgentRunRequest, context: CliContext): Promise<number> {
  const stdoutBuffer: string[] = [];
  const stderrBuffer: string[] = [];
  let sawStdoutChunk = false;
  let sawStderrChunk = false;

  let result;
  try {
    result = await context.service.runAgent(request.agentId, {
      message: request.message,
      model: request.model,
      cwd: request.cwd,
      sessionRef: request.sessionRef,
      forceNewSession: request.forceNewSession,
      disableSession: request.disableSession,
      passthroughArgs: request.passthroughArgs,
      env: process.env,
      onStdout: request.stream
        ? (chunk) => {
            if (chunk) {
              sawStdoutChunk = true;
            }
            context.stdout.write(chunk);
          }
        : (chunk) => {
            if (chunk) {
              sawStdoutChunk = true;
            }
            stdoutBuffer.push(chunk);
          },
      onStderr: request.stream
        ? (chunk) => {
            if (chunk) {
              sawStderrChunk = true;
            }
            context.stderr.write(chunk);
          }
        : (chunk) => {
            if (chunk) {
              sawStderrChunk = true;
            }
            stderrBuffer.push(chunk);
          }
    });
  } catch (error) {
    context.stderr.write(`Failed to run ${request.agentId}: ${formatError(error)}\n`);
    return 1;
  }

  if (hasRoutingDetails(result) && result.entryAgentId !== result.routing.targetAgentId) {
    context.stderr.write(
      `Routed ${result.entryAgentId} -> ${result.routing.targetAgentId} (confidence ${result.routing.confidence}).\n`
    );
  }
  if (hasSessionInfo(result)) {
    context.stderr.write(`Session: ${result.session.sessionKey} (${result.session.sessionId})\n`);
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
  } else {
    // HTTP/API providers often return final stdout/stderr without streaming callbacks.
    if (!sawStdoutChunk && result.stdout) {
      context.stdout.write(result.stdout);
    }
    if (!sawStderrChunk && result.stderr) {
      context.stderr.write(result.stderr);
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

function hasRoutingDetails(
  value: unknown
): value is {
  entryAgentId: string;
  routing: { targetAgentId: string; confidence: number };
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as {
    entryAgentId?: unknown;
    routing?: { targetAgentId?: unknown; confidence?: unknown };
  };

  return (
    typeof record.entryAgentId === "string" &&
    typeof record.routing?.targetAgentId === "string" &&
    typeof record.routing?.confidence === "number"
  );
}

function hasSessionInfo(
  value: unknown
): value is {
  session: { sessionKey: string; sessionId: string };
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as {
    session?: { sessionKey?: unknown; sessionId?: unknown };
  };

  return typeof record.session?.sessionKey === "string" && typeof record.session?.sessionId === "string";
}
