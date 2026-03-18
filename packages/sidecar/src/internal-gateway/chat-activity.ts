import type { UIMessageChunk } from "ai";
import type { ChatActivity } from "@opengoat/contracts";

interface GatewayAgentEventPayload {
  data?: Record<string, unknown>;
  runId: string;
  seq: number;
  sessionKey?: string;
  stream: string;
  ts?: number;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function humanizeToolName(toolName: string): string {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) {
    return "tool";
  }

  if (normalized === "exec" || normalized === "bash") {
    return "command";
  }

  if (normalized.includes("search")) {
    return "search";
  }

  if (normalized.includes("read")) {
    return "read";
  }

  if (normalized.includes("write")) {
    return "write";
  }

  if (normalized.includes("fetch") || normalized.includes("browse")) {
    return "browse";
  }

  return normalized.replace(/[-_]+/g, " ");
}

function toSentenceCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

function createChunk(activity: ChatActivity): UIMessageChunk<unknown, { activity: ChatActivity }> {
  return {
    data: activity,
    id: activity.id,
    type: "data-activity",
  };
}

function createActivityBase(
  event: GatewayAgentEventPayload,
  overrides: Omit<ChatActivity, "id" | "sequence" | "timestamp"> & { id: string },
): ChatActivity {
  return {
    ...overrides,
    sequence: event.seq,
    timestamp: typeof event.ts === "number" ? new Date(event.ts).toISOString() : undefined,
  };
}

function mapLifecycleEvent(
  event: GatewayAgentEventPayload,
): UIMessageChunk<unknown, { activity: ChatActivity }> | null {
  const phase = normalizeText(event.data?.phase);
  if (!phase) {
    return null;
  }

  if (phase === "start") {
    return createChunk(
      createActivityBase(event, {
        id: `run:${event.runId}:status`,
        kind: "status",
        label: "Thinking",
        status: "active",
      }),
    );
  }

  if (phase === "end") {
    return createChunk(
      createActivityBase(event, {
        id: `run:${event.runId}:status`,
        kind: "status",
        label: "Finished thinking",
        status: "complete",
      }),
    );
  }

  if (phase === "error") {
    return createChunk(
      createActivityBase(event, {
        detail:
          normalizeText(event.data?.error) ?? "The assistant ran into a problem.",
        id: `run:${event.runId}:status`,
        kind: "status",
        label: "Ran into a problem",
        status: "error",
      }),
    );
  }

  return null;
}

function mapToolEvent(
  event: GatewayAgentEventPayload,
): UIMessageChunk<unknown, { activity: ChatActivity }> | null {
  const toolCallId = normalizeText(event.data?.toolCallId);
  const toolName = normalizeText(event.data?.name);
  const phase = normalizeText(event.data?.phase);
  if (!toolCallId || !toolName || !phase) {
    return null;
  }

  const friendlyName = toSentenceCase(humanizeToolName(toolName));
  const id = `run:${event.runId}:tool:${toolCallId}`;

  if (phase === "start") {
    return createChunk(
      createActivityBase(event, {
        detail: `Using ${friendlyName.toLowerCase()} to gather context.`,
        id,
        kind: "tool",
        label: `Using ${friendlyName}`,
        status: "active",
        toolName,
      }),
    );
  }

  if (phase === "update") {
    return createChunk(
      createActivityBase(event, {
        detail: "Receiving updates from the current step.",
        id,
        kind: "tool",
        label: `Using ${friendlyName}`,
        status: "active",
        toolName,
      }),
    );
  }

  if (phase === "result") {
    const isError = event.data?.isError === true;
    return createChunk(
      createActivityBase(event, {
        detail: isError
          ? normalizeText(event.data?.error) ?? "The step returned an error."
          : "Finished and incorporated the result.",
        id,
        kind: "tool",
        label: `Using ${friendlyName}`,
        status: isError ? "error" : "complete",
        toolName,
      }),
    );
  }

  return null;
}

function mapCompactionEvent(
  event: GatewayAgentEventPayload,
): UIMessageChunk<unknown, { activity: ChatActivity }> | null {
  const phase = normalizeText(event.data?.phase);
  if (!phase) {
    return null;
  }

  return createChunk(
    createActivityBase(event, {
      detail:
        phase === "start"
          ? "Condensing earlier context to stay focused."
          : "Context has been condensed and the response is continuing.",
      id: `run:${event.runId}:compaction`,
      kind: "compaction",
      label: "Condensing earlier context",
      status: phase === "start" ? "active" : "complete",
    }),
  );
}

export function toChatActivityChunk(
  event: GatewayAgentEventPayload,
): UIMessageChunk<unknown, { activity: ChatActivity }> | null {
  if (event.stream === "lifecycle") {
    return mapLifecycleEvent(event);
  }

  if (event.stream === "tool") {
    return mapToolEvent(event);
  }

  if (event.stream === "compaction") {
    return mapCompactionEvent(event);
  }

  return null;
}
