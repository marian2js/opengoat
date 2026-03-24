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

const taskQuickActionsSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/TaskQuickActions.tsx",
  ),
  "utf-8",
);

describe("Blocker, artifact, and worklog quick actions", () => {
  // AC1: Task detail panel has an "Add Blocker" action
  describe("Add Blocker action", () => {
    it("TaskQuickActions renders an Add Blocker button", () => {
      expect(taskQuickActionsSrc).toContain("Add Blocker");
    });

    it("TaskDetailPanel defines a handleAddBlocker callback", () => {
      expect(taskDetailPanelSrc).toMatch(/handleAddBlocker/);
    });

    it("TaskDetailPanel calls client.addTaskBlocker", () => {
      expect(taskDetailPanelSrc).toContain("client.addTaskBlocker");
    });
  });

  // AC2: Task detail panel has an "Add Output" action
  describe("Add Output action", () => {
    it("TaskQuickActions renders an Add Output button", () => {
      expect(taskQuickActionsSrc).toContain("Add Output");
    });

    it("TaskDetailPanel defines a handleAddArtifact callback", () => {
      expect(taskDetailPanelSrc).toMatch(/handleAddArtifact/);
    });

    it("TaskDetailPanel calls client.addTaskArtifact", () => {
      expect(taskDetailPanelSrc).toContain("client.addTaskArtifact");
    });
  });

  // AC3: Task detail panel has an "Add Worklog" action
  describe("Add Worklog action", () => {
    it("TaskQuickActions renders an Add Worklog button", () => {
      expect(taskQuickActionsSrc).toContain("Add Worklog");
    });

    it("TaskDetailPanel defines a handleAddWorklog callback", () => {
      expect(taskDetailPanelSrc).toMatch(/handleAddWorklog/);
    });

    it("TaskDetailPanel calls client.addTaskWorklog", () => {
      expect(taskDetailPanelSrc).toContain("client.addTaskWorklog");
    });
  });

  // AC4: After adding, new entry appears without page refresh (refresh() + onTaskUpdated() called)
  describe("Auto-refresh after mutation", () => {
    it("handleAddBlocker calls refresh() after mutation", () => {
      // The handler should call refresh() to reload task details
      const blockerHandlerMatch = taskDetailPanelSrc.match(
        /handleAddBlocker[\s\S]*?addTaskBlocker[\s\S]*?refresh\(\)/,
      );
      expect(blockerHandlerMatch).toBeTruthy();
    });

    it("handleAddArtifact calls refresh() after mutation", () => {
      const artifactHandlerMatch = taskDetailPanelSrc.match(
        /handleAddArtifact[\s\S]*?addTaskArtifact[\s\S]*?refresh\(\)/,
      );
      expect(artifactHandlerMatch).toBeTruthy();
    });

    it("handleAddWorklog calls refresh() after mutation", () => {
      const worklogHandlerMatch = taskDetailPanelSrc.match(
        /handleAddWorklog[\s\S]*?addTaskWorklog[\s\S]*?refresh\(\)/,
      );
      expect(worklogHandlerMatch).toBeTruthy();
    });

    it("handleAddBlocker calls onTaskUpdated() after mutation", () => {
      const match = taskDetailPanelSrc.match(
        /handleAddBlocker[\s\S]*?addTaskBlocker[\s\S]*?onTaskUpdated\(\)/,
      );
      expect(match).toBeTruthy();
    });
  });

  // AC5: x-actor-id header is sent (task.owner passed as actorId)
  describe("x-actor-id header via task.owner", () => {
    it("handleAddBlocker passes task?.owner to addTaskBlocker", () => {
      expect(taskDetailPanelSrc).toMatch(
        /addTaskBlocker\([^)]*task\?\.owner/,
      );
    });

    it("handleAddArtifact passes task?.owner to addTaskArtifact", () => {
      expect(taskDetailPanelSrc).toMatch(
        /addTaskArtifact\([^)]*task\?\.owner/,
      );
    });

    it("handleAddWorklog passes task?.owner to addTaskWorklog", () => {
      expect(taskDetailPanelSrc).toMatch(
        /addTaskWorklog\([^)]*task\?\.owner/,
      );
    });
  });

  // TaskQuickActions accepts the add-entry callbacks
  describe("TaskQuickActions props", () => {
    it("accepts onAddBlocker prop", () => {
      expect(taskQuickActionsSrc).toContain("onAddBlocker");
    });

    it("accepts onAddArtifact prop", () => {
      expect(taskQuickActionsSrc).toContain("onAddArtifact");
    });

    it("accepts onAddWorklog prop", () => {
      expect(taskQuickActionsSrc).toContain("onAddWorklog");
    });
  });

  // Inline text input for content entry
  describe("Inline content input", () => {
    it("has a text input for entering content", () => {
      expect(taskQuickActionsSrc).toMatch(/type="text"/);
    });

    it("supports Enter key to submit", () => {
      // Existing pattern: onKeyDown handler with Enter
      expect(taskQuickActionsSrc).toMatch(/Enter/);
    });

    it("supports Escape key to cancel", () => {
      expect(taskQuickActionsSrc).toMatch(/Escape/);
    });
  });
});
