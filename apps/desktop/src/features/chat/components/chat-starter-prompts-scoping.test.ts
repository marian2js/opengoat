import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ChatWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Bug fix: starterPrompts must be scoped inside ChatSessionView, not ChatWorkspace
// See task 0014: ReferenceError crash when starterPrompts crosses function boundary
// ---------------------------------------------------------------------------

void test("starterPrompts useMemo is inside ChatSessionView, not ChatWorkspace", () => {
  // Find where ChatSessionView function starts
  const sessionViewStart = src.indexOf("function ChatSessionView(");
  assert.ok(sessionViewStart > 0, "ChatSessionView function must exist");

  // The starterPrompts useMemo should appear AFTER ChatSessionView starts
  const starterPromptsInSessionView = src.indexOf(
    "starterPrompts",
    sessionViewStart,
  );
  assert.ok(
    starterPromptsInSessionView > sessionViewStart,
    "starterPrompts must be defined inside ChatSessionView (co-located with usage)",
  );
});

void test("ChatWorkspace does NOT compute starterPrompts", () => {
  // Find where ChatWorkspace and ChatSessionView functions start
  const workspaceStart = src.indexOf("function ChatWorkspace(");
  const sessionViewStart = src.indexOf("function ChatSessionView(");
  assert.ok(workspaceStart > 0, "ChatWorkspace function must exist");
  assert.ok(sessionViewStart > 0, "ChatSessionView function must exist");

  // Extract just the ChatWorkspace function body (between its start and ChatSessionView)
  const workspaceBody = src.slice(workspaceStart, sessionViewStart);

  // starterPrompts useMemo should NOT be in ChatWorkspace body
  assert.ok(
    !workspaceBody.includes("const starterPrompts"),
    "ChatWorkspace must NOT define starterPrompts (it should be in ChatSessionView)",
  );
});

void test("starterPrompts uses getSpecialistMeta for specialist-specific prompts", () => {
  const sessionViewStart = src.indexOf("function ChatSessionView(");
  const sessionViewBody = src.slice(sessionViewStart);

  assert.ok(
    sessionViewBody.includes("getSpecialistMeta"),
    "ChatSessionView must use getSpecialistMeta to resolve specialist-specific starter prompts",
  );
  assert.ok(
    sessionViewBody.includes("DEFAULT_STARTER_PROMPTS"),
    "ChatSessionView must fall back to DEFAULT_STARTER_PROMPTS for non-specialist chats",
  );
});

void test("DEFAULT_STARTER_PROMPTS contains generic CMO starters", () => {
  assert.ok(
    src.includes("highest-leverage marketing move"),
    "Default starters must include generic CMO prompt about highest-leverage move",
  );
  assert.ok(
    src.includes("Which specialist should I start with"),
    "Default starters must include prompt about which specialist to start with",
  );
  assert.ok(
    src.includes("Summarize opportunities"),
    "Default starters must include prompt about summarizing opportunities",
  );
});
