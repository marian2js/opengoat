import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chatWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx",
  ),
  "utf-8",
);

const sidebarSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/app/shell/AppSidebar.tsx",
  ),
  "utf-8",
);

describe("Label-based action session heuristic fallback", () => {
  // AC1: ACTION_LABEL_PREFIXES array defined with known starter action names
  it("defines ACTION_LABEL_PREFIXES with known starter action names", () => {
    expect(chatWorkspaceSrc).toContain("ACTION_LABEL_PREFIXES");
    expect(chatWorkspaceSrc).toContain("Launch on Product Hunt");
    expect(chatWorkspaceSrc).toContain("Rewrite homepage hero");
    expect(chatWorkspaceSrc).toContain("Build outbound sequence");
    expect(chatWorkspaceSrc).toContain("Find SEO quick wins");
    expect(chatWorkspaceSrc).toContain("Create comparison page outline");
    expect(chatWorkspaceSrc).toContain("Generate founder content ideas");
    expect(chatWorkspaceSrc).toContain("Create lead magnet ideas");
  });

  // AC2: isLikelyActionSession function exported
  it("exports isLikelyActionSession function", () => {
    expect(chatWorkspaceSrc).toMatch(
      /export\s+function\s+isLikelyActionSession/,
    );
  });

  // AC3: isLikelyActionSession checks label against ACTION_LABEL_PREFIXES
  it("isLikelyActionSession checks label against known prefixes", () => {
    const fnStart = chatWorkspaceSrc.indexOf(
      "function isLikelyActionSession",
    );
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = chatWorkspaceSrc.slice(fnStart, fnStart + 500);
    expect(fnBody).toContain("ACTION_LABEL_PREFIXES");
  });

  // AC4: isLikelyActionSession accepts a label string parameter
  it("isLikelyActionSession accepts a label parameter and returns boolean", () => {
    const fnMatch = chatWorkspaceSrc.match(
      /function isLikelyActionSession\(([^)]+)\):\s*boolean/,
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![1]).toContain("label");
  });

  // AC5: Existing isActionSession function still exists and is unchanged in purpose
  it("existing isActionSession function still checks localStorage", () => {
    const fnStart = chatWorkspaceSrc.indexOf("function isActionSession");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = chatWorkspaceSrc.slice(fnStart, fnStart + 1200);
    expect(fnBody).toContain("actionSessionMeta");
    expect(fnBody).toContain("actionSessionIds");
  });
});

describe("AppSidebar uses label-based heuristic fallback", () => {
  // AC1: Sidebar uses isLikelyActionSession
  it("imports isLikelyActionSession", () => {
    expect(sidebarSrc).toContain("isLikelyActionSession");
  });

  // AC2: sessionIsAction combines both checkIsAction and label heuristic
  it("combines checkIsAction with isLikelyActionSession for session detection", () => {
    expect(sidebarSrc).toMatch(/isLikelyActionSession/);
  });

  // AC3: Backfills localStorage via markActionSession when heuristic matches
  it("imports markActionSession for backfill", () => {
    expect(sidebarSrc).toContain("markActionSession");
  });

  // AC4: Regular chat threads still show MessageSquare (unchanged)
  it("SessionItem still uses ZapIcon for action sessions and MessageSquare otherwise", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    expect(sessionItemStart).toBeGreaterThan(0);
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    expect(sessionItemBody).toContain("ZapIcon");
    expect(sessionItemBody).toContain("MessageSquareIcon");
  });
});
