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

const taskDetailPanelSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/TaskDetailPanel.tsx",
  ),
  "utf-8",
);

describe("Board error state – retry button polish", () => {
  // AC1: Board workspace error state uses a <Button> component for the retry action
  describe("BoardWorkspace error state uses Button component", () => {
    it("imports Button from @/components/ui/button", () => {
      expect(boardWorkspaceSrc).toContain(
        'from "@/components/ui/button"',
      );
    });

    it("uses <Button> instead of a plain <button> for retry", () => {
      // The error block should use <Button variant="outline" size="sm">
      expect(boardWorkspaceSrc).toMatch(/<Button\s[^>]*variant="outline"/);
      expect(boardWorkspaceSrc).toMatch(/<Button\s[^>]*size="sm"/);
    });

    it("does not use text-link style for the retry action", () => {
      // The old pattern: text-xs text-primary underline-offset-4 hover:underline
      expect(boardWorkspaceSrc).not.toContain(
        'text-xs text-primary underline-offset-4 hover:underline',
      );
    });
  });

  // AC2: Retry button has a RefreshCwIcon for immediate visual clarity
  describe("Retry button has RefreshCwIcon", () => {
    it("imports RefreshCwIcon in BoardWorkspace", () => {
      expect(boardWorkspaceSrc).toContain("RefreshCwIcon");
    });

    it("uses RefreshCwIcon inside the retry button", () => {
      // The icon should appear near the "Try again" text
      expect(boardWorkspaceSrc).toMatch(/RefreshCwIcon[\s\S]*?Try again/);
    });
  });

  // AC3: Error icon is wrapped in the same rounded container as the empty state icon
  describe("Error icon wrapped in rounded container", () => {
    it("wraps the error icon in a rounded-xl bg-muted/50 container", () => {
      // Match the pattern: a div with size-12 rounded-xl bg-muted/50 containing AlertCircleIcon
      expect(boardWorkspaceSrc).toMatch(
        /size-12[\s\S]*?rounded-xl[\s\S]*?bg-muted\/50[\s\S]*?AlertCircleIcon/,
      );
    });
  });

  // AC4: Task Detail Panel error state also uses a <Button> for retry
  describe("TaskDetailPanel error state uses Button component", () => {
    it("imports Button from @/components/ui/button", () => {
      expect(taskDetailPanelSrc).toContain(
        'from "@/components/ui/button"',
      );
    });

    it("uses <Button> with outline variant for retry", () => {
      expect(taskDetailPanelSrc).toMatch(/<Button\s[^>]*variant="outline"/);
      expect(taskDetailPanelSrc).toMatch(/<Button\s[^>]*size="sm"/);
    });

    it("does not use text-link style for the retry action", () => {
      expect(taskDetailPanelSrc).not.toContain(
        'text-xs text-primary underline-offset-4 hover:underline',
      );
    });

    it("imports RefreshCwIcon in TaskDetailPanel", () => {
      expect(taskDetailPanelSrc).toContain("RefreshCwIcon");
    });
  });

  // AC5: Error states feel intentionally designed
  describe("Consistent error state design", () => {
    it("TaskDetailPanel wraps error icon in a rounded container", () => {
      expect(taskDetailPanelSrc).toMatch(
        /size-12[\s\S]*?rounded-xl[\s\S]*?bg-muted\/50[\s\S]*?AlertCircleIcon/,
      );
    });
  });
});
