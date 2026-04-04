import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------

const specialistTeamBrowserSrc = readFileSync(
  resolve(import.meta.dirname, "SpecialistTeamBrowser.tsx"),
  "utf-8",
);

const specialistCardSrc = readFileSync(
  resolve(import.meta.dirname, "SpecialistCard.tsx"),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(import.meta.dirname, "../../../app/App.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC: SpecialistTeamBrowser accepts onSpecialistChat callback prop
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser interface includes onSpecialistChat prop", () => {
  assert.ok(
    specialistTeamBrowserSrc.includes("onSpecialistChat"),
    "SpecialistTeamBrowserProps must include onSpecialistChat callback",
  );
});

void test("SpecialistTeamBrowser destructures onSpecialistChat from props", () => {
  assert.ok(
    specialistTeamBrowserSrc.includes("onSpecialistChat }"),
    "Component must destructure onSpecialistChat from props",
  );
});

// ---------------------------------------------------------------------------
// AC: handleChat uses direct callback when available (not hash navigation)
// ---------------------------------------------------------------------------

void test("handleChat calls onSpecialistChat when provided", () => {
  assert.ok(
    specialistTeamBrowserSrc.includes("onSpecialistChat(specialistId)") ||
      specialistTeamBrowserSrc.includes("onSpecialistChat(specialistId);"),
    "handleChat must call onSpecialistChat(specialistId) when the callback is provided",
  );
});

void test("handleChat still has hash fallback for backward compatibility", () => {
  assert.ok(
    specialistTeamBrowserSrc.includes("#chat?specialist="),
    "handleChat must retain hash-based navigation as fallback",
  );
});

// ---------------------------------------------------------------------------
// AC: App.tsx defines handleSpecialistChat that creates session directly
// ---------------------------------------------------------------------------

void test("App.tsx has handleSpecialistChat callback", () => {
  assert.ok(
    appSrc.includes("handleSpecialistChat"),
    "App must define a handleSpecialistChat callback for direct session creation",
  );
});

void test("handleSpecialistChat creates session with specialistId", () => {
  // Find the handleSpecialistChat function body
  const fnStart = appSrc.indexOf("handleSpecialistChat");
  assert.ok(fnStart >= 0, "handleSpecialistChat must exist");

  const fnBlock = appSrc.slice(fnStart, fnStart + 600);
  assert.ok(
    fnBlock.includes("createSession") && fnBlock.includes("specialistId"),
    "handleSpecialistChat must call createSession with specialistId",
  );
});

void test("handleSpecialistChat sets activeSessionId before navigating", () => {
  const fnStart = appSrc.indexOf("handleSpecialistChat");
  const fnBlock = appSrc.slice(fnStart, fnStart + 600);

  const setActiveIdx = fnBlock.indexOf("setActiveSessionId");
  const hashIdx = fnBlock.indexOf('window.location.hash = "#chat"');
  assert.ok(setActiveIdx >= 0, "Must call setActiveSessionId");
  assert.ok(hashIdx >= 0, "Must navigate to #chat");
  assert.ok(
    setActiveIdx < hashIdx,
    "setActiveSessionId must be called before navigation to ensure session is ready",
  );
});

void test("handleSpecialistChat sets currentSpecialistId", () => {
  const fnStart = appSrc.indexOf("handleSpecialistChat");
  const fnBlock = appSrc.slice(fnStart, fnStart + 600);

  assert.ok(
    fnBlock.includes("setCurrentSpecialistId"),
    "handleSpecialistChat must set currentSpecialistId for chat specialist context",
  );
});

// ---------------------------------------------------------------------------
// AC: App.tsx passes onSpecialistChat to SpecialistTeamBrowser
// ---------------------------------------------------------------------------

void test("App.tsx passes onSpecialistChat to SpecialistTeamBrowser", () => {
  assert.ok(
    appSrc.includes("onSpecialistChat={handleSpecialistChat}"),
    "App must pass onSpecialistChat={handleSpecialistChat} to SpecialistTeamBrowser",
  );
});

// ---------------------------------------------------------------------------
// AC: SpecialistCard button wiring unchanged — onChat callback for all cards
// ---------------------------------------------------------------------------

void test("SpecialistCard button onClick calls onChat(specialist.id)", () => {
  assert.ok(
    specialistCardSrc.includes("onClick={() => onChat(specialist.id)}"),
    "Button must call onChat(specialist.id) on click — this is unchanged",
  );
});

void test("SpecialistTeamBrowser passes onChat to all specialist cards", () => {
  // Both manager and operational cards must receive onChat={handleChat}
  const occurrences = specialistTeamBrowserSrc.match(/onChat=\{handleChat\}/g);
  assert.ok(
    occurrences !== null && occurrences.length >= 2,
    "onChat={handleChat} must appear at least twice (manager + operational cards)",
  );
});

// ---------------------------------------------------------------------------
// AC: All 8 specialist IDs are valid for the navigation chain
// ---------------------------------------------------------------------------

const specialistMetaSrc = readFileSync(
  resolve(import.meta.dirname, "../specialist-meta.ts"),
  "utf-8",
);

const expectedSpecialists = [
  "cmo",
  "market-intel",
  "positioning",
  "website-conversion",
  "seo-aeo",
  "distribution",
  "content",
  "outbound",
];

for (const id of expectedSpecialists) {
  void test(`specialist "${id}" exists in specialist-meta.ts`, () => {
    assert.ok(
      specialistMetaSrc.includes(`"${id}":`) || specialistMetaSrc.includes(`${id}:`),
      `SPECIALIST_META must define specialist "${id}"`,
    );
  });
}

// ---------------------------------------------------------------------------
// AC: handleSpecialistChat is a useCallback (avoids stale closure)
// ---------------------------------------------------------------------------

void test("handleSpecialistChat is wrapped in useCallback", () => {
  // Check that handleSpecialistChat is defined via useCallback to prevent
  // unnecessary re-renders and stale closures
  const callbackIdx = appSrc.indexOf("handleSpecialistChat = useCallback");
  assert.ok(
    callbackIdx >= 0,
    "handleSpecialistChat must be wrapped in useCallback",
  );
});

// ---------------------------------------------------------------------------
// AC: Error handling exists for session creation failure
// ---------------------------------------------------------------------------

void test("handleSpecialistChat has error handling with user toast", () => {
  const fnStart = appSrc.indexOf("handleSpecialistChat");
  const fnBlock = appSrc.slice(fnStart, fnStart + 600);
  assert.ok(
    fnBlock.includes("catch") && fnBlock.includes("toast.error"),
    "handleSpecialistChat must catch errors and show toast to user",
  );
});

// ---------------------------------------------------------------------------
// AC: Hash-based effect still works for Dashboard and handoff chip navigation
// ---------------------------------------------------------------------------

void test("App.tsx retains the auto-creation effect for hash-based navigation", () => {
  assert.ok(
    appSrc.includes("specialistCreatingRef"),
    "The hash-based auto-creation effect must still exist for Dashboard/handoff navigation",
  );
});
