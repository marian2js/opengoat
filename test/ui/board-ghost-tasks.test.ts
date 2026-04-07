import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardWorkspace.tsx",
  ),
  "utf-8",
);

const taskListSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/TaskList.tsx",
  ),
  "utf-8",
);

const ghostTasksSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/lib/ghost-tasks.ts",
  ),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Ghost task data module
// ---------------------------------------------------------------------------

describe("Ghost tasks data module", () => {
  it("exports a getGhostTasks function", () => {
    expect(ghostTasksSrc).toMatch(/export\s+function\s+getGhostTasks/);
  });

  it("exports the GHOST_TASK_PREFIX constant", () => {
    expect(ghostTasksSrc).toMatch(/export\s+const\s+GHOST_TASK_PREFIX/);
  });

  it("contains marketing-relevant example task titles", () => {
    // At least one example about homepage/website conversion
    expect(ghostTasksSrc).toMatch(/homepage|hero|rewrite|website/i);
    // At least one about SEO/content
    expect(ghostTasksSrc).toMatch(/seo|blog|content|pages/i);
    // At least one about distribution/launch
    expect(ghostTasksSrc).toMatch(/launch|distribution|product hunt|checklist/i);
  });

  it("returns fewer ghost tasks as real task count increases", () => {
    // The function takes a count and returns 3 - count (capped at 0)
    expect(ghostTasksSrc).toMatch(/Math\.max|3\s*-/);
  });
});

// ---------------------------------------------------------------------------
// Ghost row rendering in TaskList
// ---------------------------------------------------------------------------

describe("Ghost row rendering in TaskList", () => {
  it("TaskList accepts a ghostTasks prop", () => {
    expect(taskListSrc).toMatch(/ghostTasks/);
  });

  it("renders ghost rows with visually distinct styling", () => {
    // Ghost rows should have reduced opacity or dashed border
    expect(taskListSrc).toMatch(/opacity|dashed|ghost/i);
  });

  it("renders an EXAMPLE badge on ghost rows", () => {
    expect(taskListSrc).toMatch(/EXAMPLE/);
  });

  it("ghost rows are not clickable / have no interactive behavior", () => {
    // Ghost rows should use pointer-events-none or not have onClick
    expect(taskListSrc).toMatch(/pointer-events-none|GhostRow/);
  });
});

// ---------------------------------------------------------------------------
// BoardWorkspace integration
// ---------------------------------------------------------------------------

describe("BoardWorkspace ghost task integration", () => {
  it("imports getGhostTasks from the lib module", () => {
    expect(boardWorkspaceSrc).toMatch(/getGhostTasks/);
  });

  it("passes ghost tasks to TaskList when tasks < 3", () => {
    expect(boardWorkspaceSrc).toMatch(/ghostTasks/);
  });

  it("has value-oriented encouragement copy instead of process instruction", () => {
    // Should NOT have the old process-oriented copy
    expect(boardWorkspaceSrc).not.toContain("Create tasks from chat or actions");
    // Should have value-oriented copy
    expect(boardWorkspaceSrc).toMatch(/follow-up|tasks appear here|review and action/i);
  });

  it("no longer references 'Create tasks from chat or actions'", () => {
    expect(boardWorkspaceSrc).not.toContain("Create tasks from chat or actions");
  });
});

// ---------------------------------------------------------------------------
// Ghost task logic unit tests
// ---------------------------------------------------------------------------

describe("getGhostTasks function behavior", () => {
  let getGhostTasks: (count: number) => Array<{ taskId: string; title: string; status: string }>;
  let GHOST_TASK_PREFIX: string;

  beforeAll(async () => {
    const mod = await import(
      resolve(
        __dirname,
        "../../apps/desktop/src/features/board/lib/ghost-tasks.ts",
      )
    );
    getGhostTasks = mod.getGhostTasks;
    GHOST_TASK_PREFIX = mod.GHOST_TASK_PREFIX;
  });

  it("returns 3 ghost tasks when 0 real tasks", () => {
    expect(getGhostTasks(0)).toHaveLength(3);
  });

  it("returns 2 ghost tasks when 1 real task", () => {
    expect(getGhostTasks(1)).toHaveLength(2);
  });

  it("returns 1 ghost task when 2 real tasks", () => {
    expect(getGhostTasks(2)).toHaveLength(1);
  });

  it("returns 0 ghost tasks when 3+ real tasks", () => {
    expect(getGhostTasks(3)).toHaveLength(0);
    expect(getGhostTasks(10)).toHaveLength(0);
  });

  it("all ghost task IDs start with the ghost prefix", () => {
    const ghosts = getGhostTasks(0);
    for (const t of ghosts) {
      expect(t.taskId).toMatch(new RegExp(`^${GHOST_TASK_PREFIX}`));
    }
  });

  it("ghost tasks have unique IDs", () => {
    const ghosts = getGhostTasks(0);
    const ids = ghosts.map((t) => t.taskId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
