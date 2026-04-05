import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardWorkspace.tsx",
  ),
  "utf-8",
);

const boardToolbarSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardToolbar.tsx",
  ),
  "utf-8",
);

describe("Board polish – heading, empty state copy, task count", () => {
  // AC1: No h2 "Board" heading inside BoardWorkspace content
  describe("Duplicate heading removal", () => {
    it("does not render an h2 Board heading in the content area", () => {
      expect(boardWorkspaceSrc).not.toMatch(/<h2[^>]*>Board<\/h2>/);
    });

    it("does not contain a heading row with the Board title", () => {
      // The old heading row had text-lg font-semibold "Board"
      expect(boardWorkspaceSrc).not.toContain(
        'text-lg font-semibold text-foreground">Board',
      );
    });
  });

  // AC2: Refresh button is accessible without the heading row (moved to toolbar)
  describe("Refresh button placement", () => {
    it("has a refresh button in BoardToolbar", () => {
      expect(boardToolbarSrc).toContain("RefreshCwIcon");
      expect(boardToolbarSrc).toMatch(/Refresh tasks/);
    });

    it("BoardWorkspace no longer has the standalone heading-row refresh button", () => {
      // The old pattern was: a div with h2 "Board" + refresh button
      // The refresh button should not be directly in the heading row anymore
      expect(boardWorkspaceSrc).not.toMatch(
        /className="mb-4 flex items-center justify-between"[\s\S]*?<h2/,
      );
    });
  });

  // AC3: Empty state description does not repeat "No tasks yet"
  describe("Empty state copy", () => {
    it("does not repeat 'No tasks yet' in the description paragraph", () => {
      // The <p> description should not start with "No tasks yet."
      expect(boardWorkspaceSrc).not.toMatch(
        /<p[^>]*>\s*No tasks yet\./,
      );
    });

    it("still shows 'No tasks yet' as the h3 title", () => {
      expect(boardWorkspaceSrc).toMatch(/<h3[^>]*>\s*No tasks yet\s*<\/h3>/);
    });

    it("shows a helpful description without repeating the title", () => {
      expect(boardWorkspaceSrc).toContain(
        "Tasks appear here when specialists create follow-up items",
      );
    });
  });

  // AC4: Task count is visible when the task list is populated
  describe("Task count display", () => {
    it("BoardToolbar accepts totalCount and filteredCount props", () => {
      expect(boardToolbarSrc).toContain("totalCount");
      expect(boardToolbarSrc).toContain("filteredCount");
    });

    it("renders task count text", () => {
      // Should show something like "X tasks" or "X of Y tasks"
      expect(boardToolbarSrc).toMatch(/tasks/);
    });
  });

  // AC5: When filters are active and reduce the result set, count reflects this
  describe("Filtered task count", () => {
    it("shows 'X of Y tasks' format when filtered count differs from total", () => {
      // The toolbar should conditionally render "X of Y tasks" vs "X tasks"
      expect(boardToolbarSrc).toMatch(/of.*totalCount|totalCount.*of/s);
    });

    it("shows simple count when all tasks are displayed", () => {
      // When filteredCount === totalCount, just show "X tasks"
      expect(boardToolbarSrc).toMatch(/filteredCount\s*===\s*totalCount|totalCount\s*===\s*filteredCount/);
    });
  });

  // Verify BoardWorkspace passes count props to toolbar
  describe("Integration: BoardWorkspace passes counts to toolbar", () => {
    it("passes totalCount to BoardToolbar", () => {
      expect(boardWorkspaceSrc).toMatch(/totalCount=\{tasks\.length\}/);
    });

    it("passes filteredCount to BoardToolbar", () => {
      expect(boardWorkspaceSrc).toMatch(/filteredCount=\{filteredTasks\.length\}/);
    });
  });
});
