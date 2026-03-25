import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests for isActionSession() detection logic in ChatWorkspace.
 *
 * The function must detect action sessions from TWO localStorage keys:
 *   1. "opengoat:actionSessions" — an array of session IDs
 *   2. "opengoat:actionSessionMeta" — a record keyed by session ID (fallback)
 *
 * Previously only (1) was checked, so sessions registered only via
 * setActionSessionMeta() were never detected.
 */

// We test by reading the source and verifying the detection logic exists,
// since the module uses browser-only localStorage at module scope.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chatWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx",
  ),
  "utf-8",
);

describe("isActionSession() detection — meta fallback", () => {
  // AC1: isActionSession checks opengoat:actionSessionMeta as fallback
  it("isActionSession checks actionSessionMeta localStorage key", () => {
    const fnStart = chatWorkspaceSrc.indexOf("function isActionSession");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = chatWorkspaceSrc.slice(fnStart, fnStart + 1200);
    expect(fnBody).toContain("actionSessionMeta");
  });

  // AC2: When meta key has entry for a session, isActionSession returns true
  it("isActionSession fallback parses meta as object and checks sessionId key", () => {
    const fnStart = chatWorkspaceSrc.indexOf("function isActionSession");
    const fnBody = chatWorkspaceSrc.slice(fnStart, fnStart + 1200);
    // Should parse meta JSON and check for sessionId as a key
    expect(fnBody).toMatch(/JSON\.parse/);
    // Should access the parsed meta using sessionId (possibly with type cast)
    expect(fnBody).toMatch(/\[sessionId\]/);
  });

  // AC3: Fallback backfills into the in-memory Set for subsequent lookups
  it("isActionSession backfills session into actionSessionIds Set", () => {
    const fnStart = chatWorkspaceSrc.indexOf("function isActionSession");
    const fnBody = chatWorkspaceSrc.slice(fnStart, fnStart + 1200);
    // Should add the ID to the in-memory set on fallback hit
    expect(fnBody).toMatch(/actionSessionIds\.add\(sessionId\)/);
  });

  // AC4: Module-level hydration also merges IDs from actionSessionMeta
  it("hydration block merges IDs from actionSessionMeta on module load", () => {
    // The hydration code runs at module scope before any function definitions
    const fnStart = chatWorkspaceSrc.indexOf("function isActionSession");
    const hydrationBlock = chatWorkspaceSrc.slice(0, fnStart);
    expect(hydrationBlock).toContain("actionSessionMeta");
    // Should iterate meta keys and add them to the Set
    expect(hydrationBlock).toMatch(/actionSessionIds\.add/);
  });

  // AC5: Detection survives page refresh (reads from both localStorage keys)
  it("both localStorage keys are read during hydration", () => {
    const fnStart = chatWorkspaceSrc.indexOf("function isActionSession");
    const hydrationBlock = chatWorkspaceSrc.slice(0, fnStart);
    expect(hydrationBlock).toContain("opengoat:actionSessions");
    expect(hydrationBlock).toContain("opengoat:actionSessionMeta");
  });
});

describe("Existing sidebar rendering tests still pass", () => {
  const sidebarSrc = readFileSync(
    resolve(
      __dirname,
      "../../apps/desktop/src/app/shell/AppSidebar.tsx",
    ),
    "utf-8",
  );

  it("AppSidebar still uses isActionSession", () => {
    expect(sidebarSrc).toContain("isActionSession");
  });

  it("SessionItem still renders ZapIcon for action sessions", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    expect(sessionItemStart).toBeGreaterThan(0);
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    expect(sessionItemBody).toContain("ZapIcon");
    expect(sessionItemBody).toContain("isAction");
  });
});
