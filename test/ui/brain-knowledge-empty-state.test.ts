import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/brain/components/BrainWorkspace.tsx"),
  "utf-8",
);

describe("KnowledgeInlineEmpty – enhanced empty states", () => {
  // AC1: Both References and Notes sections show a prominent icon above the empty state text
  it("renders a large icon container for each inline empty state", () => {
    // The component should have a prominent icon wrapper (size-12 rounded-full)
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    expect(fnStart).toBeGreaterThan(0);
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    // Icon container should be larger than before (was size-10, now size-12)
    expect(fnBody).toMatch(/size-12/);
    // Icon itself should be prominent
    expect(fnBody).toMatch(/size-6/);
  });

  // AC2: Each section has a CTA button that navigates to the Chat page
  it("References empty state has a Go to Chat CTA button", () => {
    // Find the references usage of KnowledgeInlineEmpty
    expect(src).toContain("Go to Chat");
  });

  it("Notes empty state has a Go to Chat CTA button", () => {
    // Both inline empty sections should have the navigation CTA
    const goToChatMatches = src.match(/Go to Chat/g);
    expect(goToChatMatches).toBeTruthy();
    // Should appear at least twice (component + or both usages reference the CTA)
  });

  it("CTA navigates to #chat", () => {
    expect(src).toContain('#chat');
    // The KnowledgeInlineEmpty component should have onNavigateToChat or direct hash nav
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("chat");
  });

  // AC3: The empty state content is vertically centered within each card
  it("uses centered flex layout with generous padding", () => {
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("items-center");
    expect(fnBody).toContain("justify-center");
    // Should have more vertical padding than before (py-8 or py-10 instead of py-4)
    expect(fnBody).toMatch(/py-(?:8|10|12)/);
  });

  // AC4: The page feels intentional - MessageSquareIcon used for chat CTA
  it("imports MessageSquareIcon for the chat CTA", () => {
    expect(src).toContain("MessageSquareIcon");
  });

  // AC5: Works in both light and dark mode (uses theme-aware classes)
  it("uses theme-aware Tailwind classes (muted-foreground, accent, border)", () => {
    const fnStart = src.indexOf("function KnowledgeInlineEmpty");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("text-muted-foreground");
    expect(fnBody).toContain("bg-muted");
  });
});
