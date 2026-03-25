import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/brain/components/BrainWorkspace.tsx"),
  "utf-8",
);

describe("KnowledgeInlineEmpty – compact horizontal empty states", () => {
  // AC1: Component uses compact horizontal layout with icon badge
  it("renders a compact icon badge for each inline empty state", () => {
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    expect(fnStart).toBeGreaterThan(0);
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    // Icon container uses compact badge (size-8 rounded-md)
    expect(fnBody).toMatch(/size-8/);
    // Icon itself is compact
    expect(fnBody).toMatch(/size-4/);
  });

  // AC2: Each section has a CTA button that navigates to the Chat page
  it("References empty state has a Chat CTA button", () => {
    expect(src).toContain("Chat");
  });

  it("Notes empty state has a Chat CTA button", () => {
    const chatMatches = src.match(/Chat/g);
    expect(chatMatches).toBeTruthy();
  });

  it("CTA navigates to #chat", () => {
    expect(src).toContain('#chat');
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("chat");
  });

  // AC3: Uses compact horizontal flex layout
  it("uses horizontal flex layout with icon + text + actions", () => {
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("items-center");
    // Horizontal layout with gap
    expect(fnBody).toMatch(/gap-3/);
    // Compact padding
    expect(fnBody).toMatch(/py-3/);
  });

  // AC4: MessageSquareIcon used for chat CTA
  it("imports MessageSquareIcon for the chat CTA", () => {
    expect(src).toContain("MessageSquareIcon");
  });

  // AC5: Works in both light and dark mode (uses theme-aware classes)
  it("uses theme-aware Tailwind classes (muted-foreground, border)", () => {
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("text-muted-foreground");
    expect(fnBody).toContain("border");
  });
});
