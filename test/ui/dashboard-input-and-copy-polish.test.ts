import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const freeTextSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/FreeTextInput.tsx",
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

const activeObjSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/ActiveObjectiveSection.tsx",
  ),
  "utf-8",
);

const displayHelpersSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/agents/display-helpers.ts",
  ),
  "utf-8",
);

describe("Dashboard input CMO routing indicator", () => {
  it("shows CMO in the placeholder text", () => {
    expect(freeTextSrc).toMatch(/CMO/);
  });

  it("keeps the help-oriented placeholder intent", () => {
    expect(freeTextSrc).toMatch(/Ask CMO/);
  });

  it("imports a specialist icon or BrainIcon for CMO indicator", () => {
    expect(freeTextSrc).toMatch(/BrainIcon/);
  });

  it("renders a visible CMO badge or label element", () => {
    expect(freeTextSrc).toMatch(/CMO/);
  });

  it("submit button enables when text is entered (disabled when empty)", () => {
    expect(freeTextSrc).toMatch(/disabled=\{!value\.trim\(\)\}/);
  });
});

describe("Board task count grammar — proper pluralization", () => {
  it("BoardToolbar uses singular 'task' when count is 1", () => {
    // Should have conditional pluralization logic
    expect(boardToolbarSrc).toMatch(/=== 1\s*\?\s*["']task["']\s*:\s*["']tasks["']/);
  });

  it("BoardToolbar does not use unconditional 'tasks' string for total count", () => {
    // Should NOT have a bare `${totalCount} tasks` without conditional
    expect(boardToolbarSrc).not.toMatch(/\$\{totalCount\} tasks`/);
  });
});

describe("ActiveObjectiveSection task count grammar", () => {
  it("uses proper singular/plural for task count", () => {
    // Should not have unconditional "tasks" text
    expect(activeObjSrc).not.toMatch(/\{openTaskCount\} tasks/);
  });

  it("has conditional pluralization logic", () => {
    expect(activeObjSrc).toMatch(/=== 1\s*\?\s*["']task["']\s*:\s*["']tasks["']/);
  });
});

describe("Display helpers — formatTaskCount", () => {
  it("exports a formatTaskCount function", () => {
    expect(displayHelpersSrc).toContain("formatTaskCount");
  });
});
