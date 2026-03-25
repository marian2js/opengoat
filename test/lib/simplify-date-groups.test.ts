import { describe, expect, it } from "vitest";
import {
  type DateGroup,
  groupSessionsByDate,
} from "../../apps/desktop/src/lib/utils/group-sessions-by-date";
import { simplifyDateGroups } from "../../apps/desktop/src/lib/utils/simplify-date-groups";

interface FakeSession {
  id: string;
  createdAt: string;
}

function makeSession(id: string, daysAgo: number, now: Date = new Date("2026-03-25T12:00:00Z")): FakeSession {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return { id, createdAt: d.toISOString() };
}

describe("simplifyDateGroups", () => {
  const now = new Date("2026-03-25T12:00:00Z");

  it("returns empty array for empty input", () => {
    expect(simplifyDateGroups([])).toEqual([]);
  });

  it("preserves Today group as-is", () => {
    const sessions = [makeSession("a", 0, now)];
    const groups = groupSessionsByDate(sessions, now);
    const simplified = simplifyDateGroups(groups);
    expect(simplified).toHaveLength(1);
    expect(simplified[0].label).toBe("Today");
  });

  it("preserves Yesterday group as-is", () => {
    const sessions = [makeSession("a", 1, now)];
    const groups = groupSessionsByDate(sessions, now);
    const simplified = simplifyDateGroups(groups);
    expect(simplified).toHaveLength(1);
    expect(simplified[0].label).toBe("Yesterday");
  });

  it("collapses day-specific groups into This Week", () => {
    const sessions = [
      makeSession("a", 2, now),
      makeSession("b", 3, now),
      makeSession("c", 5, now),
    ];
    const groups = groupSessionsByDate(sessions, now);
    const simplified = simplifyDateGroups(groups);
    // All should collapse into "This Week"
    const thisWeek = simplified.find((g) => g.label === "This Week");
    expect(thisWeek).toBeDefined();
    expect(thisWeek!.sessions).toHaveLength(3);
  });

  it('renames "Earlier" to "Older"', () => {
    const sessions = [makeSession("a", 14, now)];
    const groups = groupSessionsByDate(sessions, now);
    const simplified = simplifyDateGroups(groups);
    expect(simplified).toHaveLength(1);
    expect(simplified[0].label).toBe("Older");
  });

  it("preserves all groups in order: Today, Yesterday, This Week, Older", () => {
    const sessions = [
      makeSession("a", 0, now),
      makeSession("b", 1, now),
      makeSession("c", 3, now),
      makeSession("d", 14, now),
    ];
    const groups = groupSessionsByDate(sessions, now);
    const simplified = simplifyDateGroups(groups);
    const labels = simplified.map((g) => g.label);
    expect(labels).toEqual(["Today", "Yesterday", "This Week", "Older"]);
  });

  it("does not create empty This Week group when no mid-range sessions exist", () => {
    const sessions = [
      makeSession("a", 0, now),
      makeSession("b", 14, now),
    ];
    const groups = groupSessionsByDate(sessions, now);
    const simplified = simplifyDateGroups(groups);
    const labels = simplified.map((g) => g.label);
    expect(labels).toEqual(["Today", "Older"]);
    expect(labels).not.toContain("This Week");
  });
});
