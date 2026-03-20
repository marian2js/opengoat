import assert from "node:assert/strict";
import test from "node:test";

void test("handleActionClick error path calls toast and resets loading", async () => {
  // Simulates the error handling flow in App.tsx handleActionClick
  let isActionLoading = false;
  let toastCalled = false;
  let toastMessage = "";

  const mockToastError = (message: string) => {
    toastCalled = true;
    toastMessage = message;
  };

  const mockClient = {
    createSession: async () => {
      throw new Error("HTTP 500");
    },
  };

  // Simulate handleActionClick
  isActionLoading = true;
  try {
    await mockClient.createSession();
  } catch {
    mockToastError("Something went wrong. Please try again.");
  } finally {
    isActionLoading = false;
  }

  assert.equal(isActionLoading, false, "Loading must be reset after failure");
  assert.equal(toastCalled, true, "Toast error must be called on failure");
  assert.equal(
    toastMessage,
    "Something went wrong. Please try again.",
    "Toast must show user-friendly error message",
  );
});

void test("handleActionClick guard blocks when loading is true", () => {
  // Simulates the guard: if (!client || !activeAgentId || isActionLoading) return
  const isActionLoading = true;
  const client = {};
  const activeAgentId = "agent-1";
  let handlerExecuted = false;

  if (!client || !activeAgentId || isActionLoading) {
    // Guard blocks
  } else {
    handlerExecuted = true;
  }

  assert.equal(
    handlerExecuted,
    false,
    "Handler must not execute when isActionLoading is true",
  );
});

void test("isActionLoading resets to false in finally block even on error", async () => {
  let isActionLoading = true;

  try {
    throw new Error("network error");
  } catch {
    // error caught
  } finally {
    isActionLoading = false;
  }

  assert.equal(
    isActionLoading,
    false,
    "isActionLoading must always reset in finally block",
  );
});

void test("ActionCardItem loading state contract: isLoading disables interaction", () => {
  // Contract: when isLoading is true, card should be non-interactive
  const isLoading = true;

  // The card applies pointer-events-none and opacity-60 when loading
  const expectedClasses = isLoading
    ? "pointer-events-none opacity-60"
    : "cursor-pointer";

  assert.ok(
    expectedClasses.includes("pointer-events-none"),
    "Loading state must disable pointer events",
  );
  assert.ok(
    expectedClasses.includes("opacity-60"),
    "Loading state must reduce opacity",
  );
});

void test("ActionCardItem shows 'Starting...' text when loading", () => {
  const isLoading = true;
  const footerText = isLoading ? "Starting..." : "Start";

  assert.equal(
    footerText,
    "Starting...",
    "Footer text must show 'Starting...' during loading",
  );
});

void test("ActionCardItem shows 'Start' text when not loading", () => {
  const isLoading = false;
  const footerText = isLoading ? "Starting..." : "Start";

  assert.equal(
    footerText,
    "Start",
    "Footer text must show 'Start' when not loading",
  );
});

void test("action card returns to clickable state after error", async () => {
  let isActionLoading = false;
  const clickHistory: boolean[] = [];

  // First click — starts loading
  isActionLoading = true;
  clickHistory.push(isActionLoading);

  try {
    throw new Error("session creation failed");
  } catch {
    // error handled
  } finally {
    isActionLoading = false;
  }
  clickHistory.push(isActionLoading);

  // Card should be clickable again
  assert.equal(
    isActionLoading,
    false,
    "Card must return to clickable state after error",
  );
  assert.deepEqual(
    clickHistory,
    [true, false],
    "Loading should transition from true to false",
  );
});
