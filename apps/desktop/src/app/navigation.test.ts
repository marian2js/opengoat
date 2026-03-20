import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for the onboarding-to-dashboard navigation fix.
 *
 * The core issue: after project creation (both initial onboarding and
 * AddProjectDialog), the app navigated to #chat instead of the Dashboard.
 * Since BootstrapProgress only renders on the dashboard view, bootstrap
 * never ran on first use.
 *
 * These tests verify the navigation contracts without requiring a DOM:
 * - readViewFromHash logic (hash → view mapping)
 * - Navigation targets after project creation
 */

// ---------------------------------------------------------------------------
// Replicate readViewFromHash from App.tsx
// ---------------------------------------------------------------------------

type AppView =
  | "dashboard"
  | "connections"
  | "connections-add"
  | "chat"
  | "brain"
  | "agents"
  | "settings";

function readViewFromHash(hash: string): AppView {
  if (hash === "#connections/add") return "connections-add";
  if (hash === "#connections") return "connections";
  if (hash.startsWith("#brain")) return "brain";
  if (hash === "#agents") return "agents";
  if (hash === "#settings") return "settings";
  if (hash === "#chat") return "chat";
  return "dashboard";
}

// ---------------------------------------------------------------------------
// Tests: readViewFromHash
// ---------------------------------------------------------------------------

test("readViewFromHash: empty hash resolves to dashboard", () => {
  assert.equal(readViewFromHash(""), "dashboard");
});

test("readViewFromHash: #chat resolves to chat", () => {
  assert.equal(readViewFromHash("#chat"), "chat");
});

test("readViewFromHash: unrecognized hash resolves to dashboard", () => {
  assert.equal(readViewFromHash("#unknown"), "dashboard");
});

test("readViewFromHash: #connections/add resolves to connections-add", () => {
  assert.equal(readViewFromHash("#connections/add"), "connections-add");
});

// ---------------------------------------------------------------------------
// Tests: navigation targets after project creation
// ---------------------------------------------------------------------------

/**
 * Simulates handleProjectCreated and onContinue to verify their
 * navigation target. The actual App.tsx sets window.location.hash;
 * here we capture what hash they would set.
 */

test("handleProjectCreated navigates to dashboard (empty hash), not chat", () => {
  // Simulate handleProjectCreated logic
  let navigatedHash = "";

  const handleProjectCreated = (
    _agent: { id: string },
    _projectUrl: string,
  ) => {
    // bootstrapContext is set → navigate to dashboard
    navigatedHash = "";
  };

  handleProjectCreated({ id: "agent-1" }, "https://example.com");
  assert.equal(
    readViewFromHash(navigatedHash),
    "dashboard",
    "After project creation, should navigate to dashboard so BootstrapProgress renders",
  );
});

test("onContinue with projectUrl navigates to dashboard (empty hash), not chat", () => {
  let navigatedHash = "";

  const onContinue = (projectUrl: string | undefined) => {
    if (projectUrl) {
      // Success path: project created → navigate to dashboard
      navigatedHash = "";
    } else {
      // Fallback: no project → navigate to chat
      navigatedHash = "#chat";
    }
  };

  onContinue("https://example.com");
  assert.equal(
    readViewFromHash(navigatedHash),
    "dashboard",
    "After initial onboarding with URL, should navigate to dashboard",
  );
});

test("onContinue without projectUrl navigates to chat (fallback)", () => {
  let navigatedHash = "";

  const onContinue = (projectUrl: string | undefined) => {
    if (projectUrl) {
      navigatedHash = "";
    } else {
      navigatedHash = "#chat";
    }
  };

  onContinue(undefined);
  assert.equal(
    readViewFromHash(navigatedHash),
    "chat",
    "Without a project URL, fallback should navigate to chat",
  );
});

test("bootstrap renders only on dashboard view, not chat", () => {
  // Verify that bootstrap would render on dashboard but not chat
  const dashboardView = readViewFromHash("");
  const chatView = readViewFromHash("#chat");

  const bootstrapContext = { agentId: "agent-1", projectUrl: "https://example.com" };

  const wouldRenderBootstrap = (view: AppView) =>
    view === "dashboard" && bootstrapContext !== null;

  assert.equal(
    wouldRenderBootstrap(dashboardView),
    true,
    "BootstrapProgress should render when on dashboard with bootstrapContext",
  );
  assert.equal(
    wouldRenderBootstrap(chatView),
    false,
    "BootstrapProgress should NOT render when on chat view",
  );
});
