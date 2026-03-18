import assert from "node:assert/strict";
import test from "node:test";
import { toChatActivityChunk } from "./chat-activity.ts";

void test("maps lifecycle events to activity chunks", () => {
  const chunk = toChatActivityChunk({
    data: { phase: "start" },
    runId: "run-1",
    seq: 1,
    stream: "lifecycle",
    ts: Date.UTC(2026, 2, 16),
  });

  assert.deepEqual(chunk, {
    data: {
      id: "run:run-1:status",
      kind: "status",
      label: "Thinking",
      sequence: 1,
      status: "active",
      timestamp: "2026-03-16T00:00:00.000Z",
    },
    id: "run:run-1:status",
    type: "data-activity",
  });
});

void test("maps tool completion events to completed activity chunks", () => {
  const chunk = toChatActivityChunk({
    data: {
      name: "web_search",
      phase: "result",
      toolCallId: "tool-1",
    },
    runId: "run-1",
    seq: 4,
    stream: "tool",
    ts: Date.UTC(2026, 2, 16, 0, 0, 4),
  });

  assert.deepEqual(chunk, {
    data: {
      detail: "Finished and incorporated the result.",
      id: "run:run-1:tool:tool-1",
      kind: "tool",
      label: "Using Search",
      sequence: 4,
      status: "complete",
      timestamp: "2026-03-16T00:00:04.000Z",
      toolName: "web_search",
    },
    id: "run:run-1:tool:tool-1",
    type: "data-activity",
  });
});

void test("ignores unsupported streams", () => {
  const chunk = toChatActivityChunk({
    data: { text: "hello" },
    runId: "run-1",
    seq: 2,
    stream: "assistant",
  });

  assert.equal(chunk, null);
});
