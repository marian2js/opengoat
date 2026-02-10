/** @vitest-environment happy-dom */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectsSidebar } from "./projects-sidebar";

afterEach(() => {
  cleanup();
});

describe("ProjectsSidebar", () => {
  it("shows a running icon next to sessions that are currently running", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        createElement(ProjectsSidebar, {
          showTrafficLightInset: false,
          projects: [
            {
              id: "p1",
              name: "Project",
              rootPath: "/tmp/project",
              createdAt: "2026-02-10T00:00:00.000Z",
              updatedAt: "2026-02-10T00:00:00.000Z",
              sessions: [
                {
                  id: "s1",
                  title: "Running Session",
                  agentId: "orchestrator",
                  sessionKey: "desktop:p1:s1",
                  createdAt: "2026-02-10T00:00:00.000Z",
                  updatedAt: "2026-02-10T00:00:00.000Z",
                  messages: []
                },
                {
                  id: "s2",
                  title: "Idle Session",
                  agentId: "orchestrator",
                  sessionKey: "desktop:p1:s2",
                  createdAt: "2026-02-10T00:00:00.000Z",
                  updatedAt: "2026-02-10T00:00:00.000Z",
                  messages: []
                }
              ]
            }
          ],
          activeProjectId: "p1",
          activeSessionId: "s1",
          runningSessionKeys: ["p1:s1"],
          busy: false,
          collapsed: false,
          agentsActive: false,
          onToggleCollapsed: vi.fn(),
          onAddProjectDialog: vi.fn(),
          onOpenAgents: vi.fn(),
          onRenameProject: vi.fn(),
          onRemoveProject: vi.fn(),
          onCreateSession: vi.fn(),
          onRenameSession: vi.fn(),
          onRemoveSession: vi.fn(),
          onSelectProject: vi.fn(),
          onSelectSession: vi.fn()
        })
      );

      expect(screen.getByLabelText("Running Session is running")).toBeTruthy();
      expect(screen.queryByLabelText("Idle Session is running")).toBeNull();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
