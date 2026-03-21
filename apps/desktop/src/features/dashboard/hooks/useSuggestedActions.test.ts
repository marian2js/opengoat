import assert from "node:assert/strict";
import test from "node:test";
import { collectStreamText } from "./useSuggestedActions.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Response from SSE lines. */
function mockSSEResponse(lines: string[]): Response {
  const text = lines.join("\n") + "\n";
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream);
}

// ---------------------------------------------------------------------------
// collectStreamText – SSE stream parsing tests
// ---------------------------------------------------------------------------

void test("collectStreamText: extracts text-delta events from SSE format", async () => {
  const response = mockSSEResponse([
    'data: {"type":"start","messageId":"m1"}',
    'data: {"type":"text-delta","delta":"Hello","id":"p1"}',
    'data: {"type":"text-delta","delta":" world","id":"p1"}',
    'data: {"type":"text-end","id":"p1"}',
    'data: {"type":"finish","finishReason":"stop"}',
  ]);

  const result = await collectStreamText(response);
  assert.equal(result, "Hello world");
});

void test("collectStreamText: returns empty string for null body", async () => {
  const response = new Response(null);
  const result = await collectStreamText(response);
  assert.equal(result, "");
});

void test("collectStreamText: ignores non-text-delta events", async () => {
  const response = mockSSEResponse([
    'data: {"type":"start","messageId":"m1"}',
    'data: {"type":"text-delta","delta":"only this","id":"p1"}',
    'data: {"type":"error","errorText":"something"}',
    'data: {"type":"finish","finishReason":"stop"}',
  ]);

  const result = await collectStreamText(response);
  assert.equal(result, "only this");
});

void test("collectStreamText: handles chunked SSE data across multiple reads", async () => {
  const encoder = new TextEncoder();
  const line = 'data: {"type":"text-delta","delta":"chunked","id":"p1"}\n';
  const mid = Math.floor(line.length / 2);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(line.slice(0, mid)));
      controller.enqueue(encoder.encode(line.slice(mid)));
      controller.close();
    },
  });
  const response = new Response(stream);

  const result = await collectStreamText(response);
  assert.equal(result, "chunked");
});

void test("collectStreamText: skips malformed JSON in data lines", async () => {
  const response = mockSSEResponse([
    "data: {malformed json}",
    'data: {"type":"text-delta","delta":"ok","id":"p1"}',
  ]);

  const result = await collectStreamText(response);
  assert.equal(result, "ok");
});

void test("collectStreamText: concatenates multiple deltas into full text", async () => {
  const response = mockSSEResponse([
    'data: {"type":"start","messageId":"m1"}',
    'data: {"type":"text-delta","delta":"[{","id":"p1"}',
    'data: {"type":"text-delta","delta":"\\"id\\"","id":"p1"}',
    'data: {"type":"text-delta","delta":": \\"test\\"}]","id":"p1"}',
    'data: {"type":"text-end","id":"p1"}',
    'data: {"type":"finish","finishReason":"stop"}',
  ]);

  const result = await collectStreamText(response);
  assert.equal(result, '[{"id": "test"}]');
});

void test("collectStreamText: ignores lines without data: prefix", async () => {
  const response = mockSSEResponse([
    ": comment line",
    'data: {"type":"text-delta","delta":"ok","id":"p1"}',
    "event: message",
    "",
  ]);

  const result = await collectStreamText(response);
  assert.equal(result, "ok");
});
