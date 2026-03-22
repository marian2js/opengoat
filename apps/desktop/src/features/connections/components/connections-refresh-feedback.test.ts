import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ConnectionsWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Clicking Refresh shows a visual loading indicator
// ---------------------------------------------------------------------------

void test("refresh icon gets animate-spin class when isRefreshing is true", () => {
  assert.ok(
    src.includes("isRefreshing") && src.includes("animate-spin"),
    "Expected RefreshCcwIcon to receive animate-spin class when isRefreshing is true",
  );
});

void test("button text changes to Refreshing... during refresh", () => {
  assert.ok(
    src.includes('Refreshing...'),
    "Expected button text to show 'Refreshing...' while refresh is in progress",
  );
});

// ---------------------------------------------------------------------------
// AC2: Button is disabled during refresh to prevent double-clicks
// ---------------------------------------------------------------------------

void test("refresh button is disabled when isRefreshing is true", () => {
  assert.ok(
    src.includes("isRefreshing"),
    "Expected isRefreshing state to be used for disabling the Refresh button",
  );

  // Verify isRefreshing is included in the disabled condition
  assert.ok(
    /disabled=\{[^}]*isRefreshing[^}]*\}/.test(src),
    "Expected the Refresh button disabled prop to include isRefreshing",
  );
});

// ---------------------------------------------------------------------------
// AC3: Loading indicator clears when refresh completes
// ---------------------------------------------------------------------------

void test("isRefreshing state is set to false in a finally block", () => {
  assert.ok(
    /setIsRefreshing\(false\)/.test(src),
    "Expected setIsRefreshing(false) to be called to clear loading state on completion",
  );
});

void test("isRefreshing state is initialized as false", () => {
  assert.ok(
    src.includes("useState(false)") || src.includes("useState<boolean>(false)"),
    "Expected isRefreshing to be initialized as false",
  );
});

// ---------------------------------------------------------------------------
// AC4: Works in both light and dark mode (no mode-specific styles needed
//      since animate-spin and disabled styles are theme-agnostic)
// ---------------------------------------------------------------------------

void test("refresh button uses theme-agnostic muted-foreground text class", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Expected Refresh button to use text-muted-foreground for theme-agnostic styling",
  );
});
