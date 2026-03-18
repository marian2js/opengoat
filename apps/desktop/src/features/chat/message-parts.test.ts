import assert from "node:assert/strict";
import test from "node:test";
import {
  getActivityParts,
  getReasoningText,
  getTextParts,
  type ChatUIMessage,
} from "./message-parts.ts";

void test("extracts and sorts activity parts from assistant messages", () => {
  const message: ChatUIMessage = {
    id: "assistant-1",
    parts: [
      {
        data: {
          id: "tool",
          kind: "tool",
          label: "Using Search",
          sequence: 4,
          status: "active",
        },
        id: "tool",
        type: "data-activity",
      },
      {
        data: {
          id: "status",
          kind: "status",
          label: "Thinking through your request",
          sequence: 1,
          status: "active",
        },
        id: "status",
        type: "data-activity",
      },
    ],
    role: "assistant",
  };

  assert.deepEqual(getActivityParts(message).map((part) => part.id), [
    "status",
    "tool",
  ]);
});

void test("extracts reasoning and text parts", () => {
  const message: ChatUIMessage = {
    id: "assistant-1",
    parts: [
      {
        text: "Checking the latest context",
        type: "reasoning",
      },
      {
        text: "Here is the answer.",
        type: "text",
      },
    ],
    role: "assistant",
  };

  assert.equal(getReasoningText(message), "Checking the latest context");
  assert.deepEqual(getTextParts(message), ["Here is the answer."]);
});
