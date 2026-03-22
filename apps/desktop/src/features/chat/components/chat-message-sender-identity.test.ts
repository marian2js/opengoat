import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const messageSrc = readFileSync(
  resolve(import.meta.dirname, "../../../components/ai-elements/message.tsx"),
  "utf-8",
);

const workspaceSrc = readFileSync(
  resolve(import.meta.dirname, "ChatWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: AI messages display a small icon/avatar to the left of the message
// ---------------------------------------------------------------------------

void test("MessageAvatar component is exported from message.tsx", () => {
  assert.ok(
    messageSrc.includes("MessageAvatar"),
    "message.tsx must export a MessageAvatar component",
  );
});

void test("AI avatar uses SparklesIcon", () => {
  assert.ok(
    messageSrc.includes("SparklesIcon"),
    "message.tsx must import SparklesIcon for AI avatar",
  );
});

void test("ChatWorkspace renders Message with from prop for both roles", () => {
  assert.ok(
    workspaceSrc.includes('from="user"') && workspaceSrc.includes('from="assistant"'),
    "ChatWorkspace must render Message with from prop for both user and assistant roles",
  );
});

// ---------------------------------------------------------------------------
// AC2: User messages display a small icon/avatar to the right of the message
// ---------------------------------------------------------------------------

void test("User avatar uses UserIcon", () => {
  assert.ok(
    messageSrc.includes("UserIcon"),
    "message.tsx must import UserIcon for user avatar",
  );
});

// ---------------------------------------------------------------------------
// AC3: Avatars are visually muted (not dominant) — small and low-contrast
// ---------------------------------------------------------------------------

void test("Avatar uses size-6 for small 24px rendering", () => {
  assert.ok(
    messageSrc.includes("size-6"),
    "MessageAvatar must use size-6 class for 24px rendering",
  );
});

void test("Avatar uses size-3.5 icons for muted appearance", () => {
  assert.ok(
    messageSrc.includes("size-3.5"),
    "Avatar icons must use size-3.5 for a muted, non-dominant appearance",
  );
});

void test("Avatar uses rounded-full for circular shape", () => {
  assert.ok(
    messageSrc.includes("rounded-full"),
    "MessageAvatar must use rounded-full for circular shape",
  );
});

void test("AI avatar uses muted primary background", () => {
  assert.ok(
    messageSrc.includes("bg-primary/10"),
    "AI avatar must use bg-primary/10 for a low-contrast background",
  );
});

void test("User avatar uses muted secondary background", () => {
  assert.ok(
    messageSrc.includes("bg-secondary") || messageSrc.includes("bg-muted"),
    "User avatar must use a muted background color",
  );
});

// ---------------------------------------------------------------------------
// AC4: Avatars are consistent in both light and dark mode
// ---------------------------------------------------------------------------

void test("Avatar uses theme-aware color tokens (not hardcoded)", () => {
  assert.ok(
    messageSrc.includes("text-primary") && messageSrc.includes("text-muted-foreground"),
    "Avatar must use theme-aware color tokens for light/dark mode consistency",
  );
});

// ---------------------------------------------------------------------------
// AC5: Scanning a long conversation, user can instantly identify sender
// ---------------------------------------------------------------------------

void test("Message layout wraps content and avatar in a flex row", () => {
  assert.ok(
    messageSrc.includes("items-start") && messageSrc.includes("gap-2"),
    "Message layout must use flex with items-start and gap for proper avatar-content alignment",
  );
});

void test("User messages use flex-row-reverse for right-side avatar", () => {
  assert.ok(
    messageSrc.includes("flex-row-reverse"),
    "User messages must use flex-row-reverse to position avatar on the right",
  );
});
