import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – action session indicator", () => {
  // AC3: Action session threads visually distinguished from regular chats
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

  it("action sessions have a distinct accent indicator", () => {
    const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
    const sessionItemBody = sidebarSrc.slice(sessionItemStart);
    // Action sessions should have emerald accent styling
    expect(sessionItemBody).toMatch(/isAction.*text-primary|text-primary.*isAction/s);
  });
});
