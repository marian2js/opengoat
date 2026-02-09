/** @vitest-environment happy-dom */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentsPanel } from "./agents-panel";

afterEach(() => {
  cleanup();
});

describe("AgentsPanel", () => {
  it("starts direct chat for non-orchestrator agents only", () => {
    const onStartChat = vi.fn();

    render(
      createElement(AgentsPanel, {
        agents: [
          {
            id: "orchestrator",
            displayName: "Orchestrator",
            workspaceDir: "/tmp/workspaces/orchestrator",
            internalConfigDir: "/tmp/agents/orchestrator",
            providerId: "openai",
          },
          {
            id: "developer",
            displayName: "Developer",
            workspaceDir: "/tmp/workspaces/developer",
            internalConfigDir: "/tmp/agents/developer",
            providerId: "codex",
          },
        ],
        providers: [],
        loading: false,
        busy: false,
        error: null,
        notice: null,
        onRefresh: vi.fn(),
        onCreate: vi.fn(),
        onUpdate: vi.fn(),
        onDelete: vi.fn(),
        directAgentSessionsAvailable: true,
        onStartChat,
        providerConfigAvailable: true,
        onDismissNotice: vi.fn(),
        onDismissError: vi.fn(),
      }),
    );

    const chatButtons = screen.getAllByRole("button", { name: "Chat" });
    const orchestratorChat = chatButtons[0];
    const developerChat = chatButtons[1];

    expect(orchestratorChat).toBeDefined();
    expect(developerChat).toBeDefined();
    expect(orchestratorChat?.getAttribute("disabled")).not.toBeNull();
    expect(developerChat?.getAttribute("disabled")).toBeNull();

    fireEvent.click(developerChat!);
    expect(onStartChat).toHaveBeenCalledWith("developer");
  });
});
