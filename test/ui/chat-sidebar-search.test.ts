import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – search input", () => {
  // AC1: Search input at top of thread list filters threads as user types
  it("has a search input with SearchIcon", () => {
    expect(sidebarSrc).toContain("SearchIcon");
    // Should import Search icon from lucide-react
    expect(sidebarSrc).toMatch(/SearchIcon/);
  });

  it("has searchQuery state for filtering", () => {
    expect(sidebarSrc).toContain("searchQuery");
    expect(sidebarSrc).toContain("setSearchQuery");
  });

  it("renders an input element for search", () => {
    // The sidebar should contain an input for searching threads
    expect(sidebarSrc).toMatch(/<input/);
    expect(sidebarSrc).toMatch(/placeholder.*[Ss]earch/i);
  });

  it("filters sessions based on search query before grouping", () => {
    // The filtering should happen before grouping — filteredSessions should be derived from allSessions
    expect(sidebarSrc).toContain("filteredSessions");
    // Should filter using the search query with case-insensitive matching
    expect(sidebarSrc).toMatch(/toLowerCase.*searchQuery|searchQuery.*toLowerCase/s);
  });

  // AC5: Thread list remains performant with 80+ entries
  it("uses useMemo for filtered sessions", () => {
    expect(sidebarSrc).toMatch(/useMemo[\s\S]*filteredSessions|filteredSessions[\s\S]*useMemo/);
  });
});
