import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const useBoardFiltersSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/hooks/useBoardFilters.ts",
  ),
  "utf-8",
);

const boardFiltersSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/lib/board-filters.ts",
  ),
  "utf-8",
);

describe("Board default filter — show all tasks instead of only open", () => {
  // AC1: When navigating to the Board page, blocked and pending tasks are
  //      visible without user action (default filter must not be "open")
  it("defaults to the 'all' filter, not 'open'", () => {
    expect(useBoardFiltersSrc).toContain('useState<BoardFilter>("all")');
    expect(useBoardFiltersSrc).not.toContain('useState<BoardFilter>("open")');
  });

  // AC2 & AC3: Open tasks first, blocked/pending below, done at bottom
  //            — achieved by defaulting sort to "status"
  it("defaults to the 'status' sort so tasks order by priority", () => {
    expect(useBoardFiltersSrc).toContain('useState<BoardSort>("status")');
    expect(useBoardFiltersSrc).not.toContain('useState<BoardSort>("updated")');
  });

  // Verify the status priority order supports the spec requirement
  it("sorts doing and todo before blocked and pending, with done last", () => {
    // doing: 0, todo: 1, blocked: 2, pending: 3, done: 4
    const doingMatch = boardFiltersSrc.match(/doing:\s*(\d)/);
    const todoMatch = boardFiltersSrc.match(/todo:\s*(\d)/);
    const blockedMatch = boardFiltersSrc.match(/blocked:\s*(\d)/);
    const pendingMatch = boardFiltersSrc.match(/pending:\s*(\d)/);
    const doneMatch = boardFiltersSrc.match(/done:\s*(\d)/);

    expect(doingMatch).not.toBeNull();
    expect(todoMatch).not.toBeNull();
    expect(blockedMatch).not.toBeNull();
    expect(pendingMatch).not.toBeNull();
    expect(doneMatch).not.toBeNull();

    const doing = Number(doingMatch![1]);
    const todo = Number(todoMatch![1]);
    const blocked = Number(blockedMatch![1]);
    const pending = Number(pendingMatch![1]);
    const done = Number(doneMatch![1]);

    // Open tasks first
    expect(doing).toBeLessThan(blocked);
    expect(todo).toBeLessThan(blocked);
    // Blocked/pending before done
    expect(blocked).toBeLessThan(done);
    expect(pending).toBeLessThan(done);
  });

  // AC5: The "all" filter includes everything (null = no filtering)
  it("'all' filter maps to null (includes all statuses)", () => {
    expect(boardFiltersSrc).toMatch(/all:\s*null/);
  });
});
