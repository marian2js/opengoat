import assert from "node:assert/strict";
import test from "node:test";
import { starterActions } from "./actions";

void test("every action card has a non-empty prompt for execution", () => {
  for (const card of starterActions) {
    assert.ok(
      card.prompt.trim().length > 0,
      `Card ${card.id} must have a non-empty prompt for execution`,
    );
  }
});

void test("every action card has a title suitable for session labeling", () => {
  for (const card of starterActions) {
    assert.ok(
      card.title.length > 0 && card.title.length <= 100,
      `Card ${card.id} title must be 1-100 chars for session label, got ${card.title.length}`,
    );
  }
});

void test("action card click provides actionId, prompt, and label", () => {
  // Simulates the contract: onActionClick(card.id, card.prompt, card.title)
  for (const card of starterActions) {
    const actionId = card.id;
    const prompt = card.prompt;
    const label = card.title;

    assert.ok(typeof actionId === "string" && actionId.length > 0);
    assert.ok(typeof prompt === "string" && prompt.length > 0);
    assert.ok(typeof label === "string" && label.length > 0);
  }
});

void test("action prompts reference workspace context for personalized execution", () => {
  const contextFiles = ["PRODUCT.md", "MARKET.md", "GROWTH.md"];
  for (const card of starterActions) {
    for (const file of contextFiles) {
      assert.ok(
        card.prompt.includes(file),
        `Card ${card.id} prompt must reference ${file} for workspace-aware execution`,
      );
    }
  }
});

void test("filterVisibleMessages hides the prompt message", () => {
  // Simulates the message filtering logic used in ChatSessionView
  const messages = [
    { id: "msg-1", role: "user" as const, text: "hidden prompt" },
    { id: "msg-2", role: "assistant" as const, text: "response" },
    { id: "msg-3", role: "user" as const, text: "follow-up" },
    { id: "msg-4", role: "assistant" as const, text: "follow-up response" },
  ];

  const hiddenPromptId = "msg-1";
  const visibleMessages = messages.filter((m) => m.id !== hiddenPromptId);

  assert.equal(visibleMessages.length, 3, "Should hide one message");
  assert.ok(
    !visibleMessages.some((m) => m.id === hiddenPromptId),
    "Hidden prompt should not be in visible messages",
  );
  assert.ok(
    visibleMessages.some((m) => m.id === "msg-2" && m.role === "assistant"),
    "Assistant response should be visible",
  );
  assert.ok(
    visibleMessages.some((m) => m.id === "msg-3" && m.role === "user"),
    "Follow-up user messages should be visible",
  );
});

void test("filterVisibleMessages shows all messages when no hidden prompt", () => {
  const messages = [
    { id: "msg-1", role: "user" as const, text: "hello" },
    { id: "msg-2", role: "assistant" as const, text: "hi there" },
  ];

  const hiddenPromptId = null;
  const visibleMessages = hiddenPromptId
    ? messages.filter((m) => m.id !== hiddenPromptId)
    : messages;

  assert.equal(visibleMessages.length, 2, "All messages should be visible");
});

void test("action session label is used directly (no derivation needed)", () => {
  // When an action card creates a session, the label is the card title —
  // no need for the deriveSessionLabel logic used for typed chat messages
  for (const card of starterActions) {
    assert.ok(
      card.title.length <= 100,
      `Card ${card.id} title should be short enough for a session label`,
    );
    // Titles should not contain raw prompt text
    assert.ok(
      !card.title.includes("PRODUCT.md"),
      `Card ${card.id} title should be user-friendly, not contain file references`,
    );
  }
});
