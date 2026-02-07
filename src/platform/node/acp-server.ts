import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";
import { OpenGoatAcpAgent } from "../../core/acp/index.js";
import type { OpenGoatService } from "../../core/opengoat/index.js";

export interface OpenGoatAcpServerOptions {
  defaultAgentId?: string;
  defaultSessionKeyPrefix?: string;
  replayHistoryLimit?: number;
  verbose?: boolean;
}

export interface OpenGoatAcpServerHandle {
  closed: Promise<void>;
  signal: AbortSignal;
}

export function startOpenGoatAcpServer(
  service: OpenGoatService,
  options: OpenGoatAcpServerOptions = {}
): OpenGoatAcpServerHandle {
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>;
  const stream = ndJsonStream(input, output);

  const connection = new AgentSideConnection(
    (agentConnection) =>
      new OpenGoatAcpAgent({
        connection: agentConnection,
        service,
        options
      }),
    stream
  );

  return {
    closed: connection.closed,
    signal: connection.signal
  };
}
