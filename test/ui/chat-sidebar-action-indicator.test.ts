import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – action session indicator", () => {
  // AC1: Action session threads visually distinguished from regular chats
  it("accepts isActionSession prop in AppSidebar", () => {
    expect(sidebarSrc).toContain("isActionSession");
  });

  it("passes isAction flag to SessionItem", () => {
    // SessionItem should receive an isAction boolean prop
    expect(sidebarSrc).toMatch(/isAction[=:{]/);
  });

  it("SessionItem uses a different icon for action sessions", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    expect(sessionItemStart).toBeGreaterThan(0);
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    // Action sessions should use ZapIcon instead of MessageSquareIcon
    expect(sessionItemBody).toContain("ZapIcon");
    expect(sessionItemBody).toContain("isAction");
  });

  // AC2: Indicator is subtle and consistent with design system (emerald accent)
  it("action sessions have a distinct accent indicator", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    // Action sessions should have emerald accent styling
    expect(sessionItemBody).toMatch(/isAction.*text-primary|text-primary.*isAction/s);
  });

  // AC1 extension: Status badge for action sessions
  it("imports getActionSessionMeta for status info", () => {
    expect(sidebarSrc).toContain("getActionSessionMeta");
  });

  it("SessionItem shows a status badge for action sessions", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    // Should contain status badge rendering with monospace font
    expect(sessionItemBody).toContain("font-mono");
    // State badge map should exist with action session state labels
    expect(sidebarSrc).toMatch(/REVIEW/);
    expect(sidebarSrc).toMatch(/WORKING/);
    expect(sidebarSrc).toMatch(/INPUT/);
    expect(sidebarSrc).toMatch(/SAVED/);
    expect(sidebarSrc).toMatch(/DONE/);
  });

  it("status badge uses small monospace uppercase styling", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    // Badge should use uppercase monospace text at ~10px
    expect(sessionItemBody).toContain("uppercase");
    expect(sessionItemBody).toContain("font-mono");
  });

  it("SessionItem accepts actionMeta prop for status info", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    expect(sessionItemBody).toContain("actionMeta");
  });
});
