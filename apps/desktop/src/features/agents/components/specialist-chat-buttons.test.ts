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

const sidecarClientSrc = readFileSync(
  resolve(import.meta.dirname, "../../../lib/sidecar/client.ts"),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(import.meta.dirname, "../../../app/App.tsx"),
  "utf-8",
);

const specialistMetaSrc = readFileSync(
  resolve(import.meta.dirname, "../specialist-meta.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC: SidecarClient.createSession accepts specialistId
// ---------------------------------------------------------------------------

void test("SidecarClient.createSession payload type includes specialistId", () => {
  // Find the createSession method signature
  const createSessionIdx = sidecarClientSrc.indexOf("async createSession(payload:");
  assert.ok(createSessionIdx >= 0, "createSession method must exist on SidecarClient");

  // Extract the payload type block (until the closing brace + colon)
  const payloadBlock = sidecarClientSrc.slice(
    createSessionIdx,
    sidecarClientSrc.indexOf("): Promise<AgentSession>", createSessionIdx),
  );

  assert.ok(
    payloadBlock.includes("specialistId"),
    "createSession payload type must include specialistId field",
  );
});

// ---------------------------------------------------------------------------
// AC: SpecialistTeamBrowser passes onChat to ALL specialist cards
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser passes onChat to manager card", () => {
  // The manager card should receive onChat={handleChat}
  const managerSection = specialistTeamBrowserSrc.slice(
    specialistTeamBrowserSrc.indexOf("{manager ?"),
    specialistTeamBrowserSrc.indexOf("{/* Section label"),
  );
  assert.ok(
    managerSection.includes("onChat={handleChat}"),
    "Manager (CMO) card must receive onChat={handleChat}",
  );
});

void test("SpecialistTeamBrowser passes onChat to operational specialist cards", () => {
  // The operational specialists map should also pass onChat={handleChat}
  const specialistSection = specialistTeamBrowserSrc.slice(
    specialistTeamBrowserSrc.indexOf("operationalSpecialists.map"),
  );
  assert.ok(
    specialistSection.includes("onChat={handleChat}"),
    "Operational specialist cards must receive onChat={handleChat}",
  );
});

// ---------------------------------------------------------------------------
// AC: handleChat navigates to #chat?specialist=<id> for ALL specialists
// ---------------------------------------------------------------------------

void test("handleChat navigates to #chat?specialist=<id>", () => {
  assert.ok(
    specialistTeamBrowserSrc.includes("#chat?specialist="),
    "handleChat must navigate to #chat?specialist=<id>",
  );
});

void test("handleChat uses window.location.hash for navigation", () => {
  assert.ok(
    specialistTeamBrowserSrc.includes("window.location.hash"),
    "handleChat must use window.location.hash for navigation",
  );
});

// ---------------------------------------------------------------------------
// AC: SpecialistCard button calls onChat(specialist.id) for ALL variants
// ---------------------------------------------------------------------------

void test("SpecialistCard button onClick calls onChat(specialist.id)", () => {
  assert.ok(
    specialistCardSrc.includes("onClick={() => onChat(specialist.id)}"),
    "Button must call onChat(specialist.id) on click",
  );
});

void test("SpecialistCard renders same Button component for all specialists", () => {
  // There should be exactly one Button with onClick for onChat
  const matches = specialistCardSrc.match(/onClick=\{.*onChat/g);
  assert.ok(
    matches !== null && matches.length === 1,
    "There must be exactly one Button onClick wired to onChat",
  );
});

// ---------------------------------------------------------------------------
// AC: readViewFromHash in App.tsx handles #chat?specialist=<id> as "chat" view
// ---------------------------------------------------------------------------

void test("App.tsx readViewFromHash uses startsWith for #chat (not exact match)", () => {
  // Ensure the chat route uses startsWith, not exact match, so
  // #chat?specialist=<id> is correctly recognized as the "chat" view
  assert.ok(
    appSrc.includes('.startsWith("#chat")'),
    "readViewFromHash must use startsWith('#chat') to handle specialist query params",
  );
});

// ---------------------------------------------------------------------------
// AC: readSpecialistFromHash extracts specialist from #chat?specialist=<id>
// ---------------------------------------------------------------------------

void test("App.tsx readSpecialistFromHash extracts specialist from hash", () => {
  assert.ok(
    appSrc.includes("readSpecialistFromHash"),
    "App must have readSpecialistFromHash function",
  );
  assert.ok(
    appSrc.includes('#chat?'),
    "readSpecialistFromHash must check for #chat? prefix",
  );
  assert.ok(
    appSrc.includes('params.get("specialist")'),
    "readSpecialistFromHash must extract specialist param from URLSearchParams",
  );
});

// ---------------------------------------------------------------------------
// AC: App auto-creates specialist session when navigating to #chat?specialist=<id>
// ---------------------------------------------------------------------------

void test("App.tsx has specialist session auto-creation effect", () => {
  assert.ok(
    appSrc.includes("specialistId: currentSpecialistId"),
    "App must pass specialistId to createSession for specialist chat auto-creation",
  );
});

// ---------------------------------------------------------------------------
// AC: All 8 specialists defined in specialist-meta.ts
// ---------------------------------------------------------------------------

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
  void test(`specialist-meta.ts defines specialist "${id}"`, () => {
    // Each specialist ID should exist as a key in SPECIALIST_META
    assert.ok(
      specialistMetaSrc.includes(`"${id}":`) || specialistMetaSrc.includes(`${id}:`),
      `SPECIALIST_META must define specialist "${id}"`,
    );
  });
}

void test("Each specialist in specialist-meta.ts has starterSuggestions", () => {
  for (const id of expectedSpecialists) {
    // Check that there's a starterSuggestions array for each specialist
    const idIdx = specialistMetaSrc.indexOf(`"${id}":`) >= 0
      ? specialistMetaSrc.indexOf(`"${id}":`)
      : specialistMetaSrc.indexOf(`${id}:`);
    assert.ok(idIdx >= 0, `Specialist "${id}" must exist in SPECIALIST_META`);
    const nextIdOrEnd = specialistMetaSrc.indexOf("},\n", idIdx + 1);
    const block = specialistMetaSrc.slice(idIdx, nextIdOrEnd);
    assert.ok(
      block.includes("starterSuggestions"),
      `Specialist "${id}" must have starterSuggestions`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC: ChatWorkspace receives and uses specialist context
// ---------------------------------------------------------------------------

void test("App.tsx passes currentSpecialistId to ChatWorkspace", () => {
  assert.ok(
    appSrc.includes("currentSpecialistId={currentSpecialistId}"),
    "App must pass currentSpecialistId prop to ChatWorkspace",
  );
});

void test("App.tsx passes currentSpecialistName to ChatWorkspace", () => {
  assert.ok(
    appSrc.includes("currentSpecialistName={"),
    "App must pass currentSpecialistName prop to ChatWorkspace",
  );
});
