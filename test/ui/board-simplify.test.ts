import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const taskDetailPanelSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/TaskDetailPanel.tsx",
  ),
  "utf-8",
);

const taskDetailSectionsSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/TaskDetailSections.tsx",
  ),
  "utf-8",
);

const linkedArtifactsSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/LinkedArtifactsSection.tsx",
  ),
  "utf-8",
);

const taskQuickActionsSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/TaskQuickActions.tsx",
  ),
  "utf-8",
);

const suggestedActionSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/lib/suggested-action.ts",
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

const boardToolbarSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardToolbar.tsx",
  ),
  "utf-8",
);

const boardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardWorkspace.tsx",
  ),
  "utf-8",
);

const boardGroupingSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/lib/board-grouping.ts",
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

describe("Board simplification — task continuation surface", () => {
  // AC1: Linked entity sections removed from TaskDetailPanel
  describe("Linked entity sections removed from detail panel", () => {
    it("does not render LinkedObjectiveSection", () => {
      expect(taskDetailPanelSrc).not.toContain("LinkedObjectiveSection");
    });

    it("does not render LinkedRunSection", () => {
      expect(taskDetailPanelSrc).not.toContain("LinkedRunSection");
    });

    it("does not render RelatedSignalsSection", () => {
      expect(taskDetailPanelSrc).not.toContain("RelatedSignalsSection");
    });

    it("still renders TaskBlockersSection", () => {
      expect(taskDetailPanelSrc).toContain("TaskBlockersSection");
    });

    it("still renders TaskArtifactsSection", () => {
      expect(taskDetailPanelSrc).toContain("TaskArtifactsSection");
    });

    it("still renders TaskWorklogSection", () => {
      expect(taskDetailPanelSrc).toContain("TaskWorklogSection");
    });

    it("still renders SuggestedNextAction", () => {
      expect(taskDetailPanelSrc).toContain("SuggestedNextAction");
    });
  });

  // AC2: Artifact terminology renamed to outputs
  describe("Artifact → Output terminology", () => {
    it("TaskDetailSections heading says 'Outputs' not 'Artifacts'", () => {
      expect(taskDetailSectionsSrc).toContain("Outputs");
      expect(taskDetailSectionsSrc).not.toMatch(/>Artifacts</);
    });

    it("LinkedArtifactsSection heading says 'Outputs' not 'Artifacts'", () => {
      expect(linkedArtifactsSrc).toContain("Outputs");
      // Section heading should not say "Artifacts"
      const headingMatch = linkedArtifactsSrc.match(/<h4[^>]*>[\s\S]*?<\/h4>/);
      expect(headingMatch?.[0]).toContain("Outputs");
    });

    it("TaskQuickActions shows 'Add Output' not 'Add Artifact'", () => {
      expect(taskQuickActionsSrc).toContain("Add Output");
      expect(taskQuickActionsSrc).not.toContain("Add Artifact");
    });

    it("TaskQuickActions placeholder says 'output' not 'artifact'", () => {
      expect(taskQuickActionsSrc).toContain("Describe the output");
      expect(taskQuickActionsSrc).not.toContain("Describe the artifact");
    });

    it("suggested-action uses 'outputs' not 'artifacts'", () => {
      expect(suggestedActionSrc).toContain("pending output");
      expect(suggestedActionSrc).not.toContain("pending artifact");
    });

    it("suggested-action completion text uses 'outputs' not 'artifacts'", () => {
      expect(suggestedActionSrc).toContain("all outputs approved");
      expect(suggestedActionSrc).not.toContain("all artifacts approved");
    });

    it("TaskList ContextBadge label says 'outputs' not 'artifacts'", () => {
      expect(taskListSrc).toContain('label="outputs"');
      expect(taskListSrc).not.toContain('label="artifacts"');
    });
  });

  // AC3: Toolbar simplified — no objective/playbook grouping
  describe("Toolbar simplification", () => {
    it("board-grouping only has 'none' and 'status' grouping options", () => {
      expect(boardGroupingSrc).toContain('"none"');
      expect(boardGroupingSrc).toContain('"status"');
      expect(boardGroupingSrc).not.toMatch(/"objective"/);
      expect(boardGroupingSrc).not.toMatch(/"playbook"/);
    });

    it("GROUPING_OPTIONS only has No Grouping and By Status", () => {
      expect(boardGroupingSrc).toContain("No Grouping");
      expect(boardGroupingSrc).toContain("By Status");
      expect(boardGroupingSrc).not.toContain("By Objective");
      expect(boardGroupingSrc).not.toContain("By Playbook");
    });

    it("toolbar does not have objective dropdown", () => {
      expect(boardToolbarSrc).not.toContain("All Objectives");
      expect(boardToolbarSrc).not.toContain("onObjectiveChange");
    });

    it("toolbar does not have Needs Review toggle", () => {
      expect(boardToolbarSrc).not.toContain("Needs Review");
    });

    it("SOURCE_TYPE_OPTIONS does not include 'playbook'", () => {
      // "playbook" source type is removed; "action" remains
      // Check the SourceTypeFilter type definition doesn't include playbook
      expect(boardFiltersSrc).not.toMatch(/SourceTypeFilter\s*=[\s\S]*?"playbook"/);
      // Verify action is in SOURCE_TYPE_OPTIONS
      expect(boardFiltersSrc).toContain("SOURCE_TYPE_OPTIONS");
      expect(boardFiltersSrc).toMatch(/value:\s*"action"/);
    });
  });

  // AC4: Task list simplified — no ObjectiveChip or RunChip
  describe("Task list chip removal", () => {
    it("does not import ObjectiveChip", () => {
      expect(taskListSrc).not.toContain("ObjectiveChip");
    });

    it("does not import RunChip", () => {
      expect(taskListSrc).not.toContain("RunChip");
    });

    it("does not use objectiveMap prop", () => {
      expect(taskListSrc).not.toContain("objectiveMap");
    });

    it("does not use runMap prop", () => {
      expect(taskListSrc).not.toContain("runMap");
    });
  });

  // AC5: BoardWorkspace simplified — no objective/run hooks
  describe("BoardWorkspace simplified", () => {
    it("does not use useObjectiveList hook", () => {
      expect(boardWorkspaceSrc).not.toContain("useObjectiveList");
    });

    it("does not use useObjectiveMap hook", () => {
      expect(boardWorkspaceSrc).not.toContain("useObjectiveMap");
    });

    it("does not use useRunMap hook", () => {
      expect(boardWorkspaceSrc).not.toContain("useRunMap");
    });

    it("does not pass objectiveMap to TaskList", () => {
      expect(boardWorkspaceSrc).not.toContain("objectiveMap=");
    });

    it("does not pass runMap to TaskList", () => {
      expect(boardWorkspaceSrc).not.toContain("runMap=");
    });
  });

  // AC6: Empty sections hidden
  describe("Empty sections are hidden", () => {
    it("TaskBlockersSection returns null when empty", () => {
      expect(taskDetailSectionsSrc).toMatch(
        /TaskBlockersSection[\s\S]*?\.length\s*===\s*0\)\s*return\s*null/,
      );
    });

    it("TaskArtifactsSection returns null when empty", () => {
      expect(taskDetailSectionsSrc).toMatch(
        /TaskArtifactsSection[\s\S]*?\.length\s*===\s*0\)\s*return\s*null/,
      );
    });

    it("TaskWorklogSection returns null when empty", () => {
      expect(taskDetailSectionsSrc).toMatch(
        /TaskWorklogSection[\s\S]*?\.length\s*===\s*0\)\s*return\s*null/,
      );
    });

    it("LinkedArtifactsSection returns null when empty", () => {
      expect(linkedArtifactsSrc).toMatch(
        /\.length\s*===\s*0\)\s*return\s*null/,
      );
    });
  });

  // AC7: Board remains compact list view with status dots
  describe("Board remains compact list view", () => {
    it("TaskList uses Table component (list view, not kanban)", () => {
      expect(taskListSrc).toContain("Table");
      expect(taskListSrc).toContain("TableBody");
      expect(taskListSrc).toContain("TableRow");
    });

    it("TaskStatusBadge is used for status display", () => {
      expect(taskListSrc).toContain("TaskStatusBadge");
    });
  });

  // AC8: LinkedArtifactsSection simplified — no lifecycle status badges
  describe("LinkedArtifactsSection simplified", () => {
    it("does not render lifecycle status badges", () => {
      // Should not have the ARTIFACT_STATUS_STYLES or status badge rendering
      expect(linkedArtifactsSrc).not.toContain("ARTIFACT_STATUS_STYLES");
      expect(linkedArtifactsSrc).not.toContain("ready_for_review");
      expect(linkedArtifactsSrc).not.toContain("needs_changes");
    });

    it("view link says 'View' not 'Preview'", () => {
      expect(linkedArtifactsSrc).toContain('title="View"');
      expect(linkedArtifactsSrc).not.toContain('title="Preview"');
    });
  });

  // AC9: Suggested action uses continuation-focused language
  describe("Suggested action continuation language", () => {
    it("has 'Resume this task' text for tasks with activity", () => {
      expect(suggestedActionSrc).toContain("Resume this task");
    });

    it("keeps 'Start working on this task' for fresh tasks", () => {
      expect(suggestedActionSrc).toContain("Start working on this task");
    });
  });
});
