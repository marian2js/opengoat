/** @vitest-environment happy-dom */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WorkbenchMessage } from "@shared/workbench";
import { WORKBENCH_CHAT_ERROR_PROVIDER_ID } from "@shared/workbench";
import { ChatPanel } from "./chat-panel";

afterEach(() => {
  cleanup();
});

function createPanelProps(
  overrides: Partial<Parameters<typeof ChatPanel>[0]> = {},
): Parameters<typeof ChatPanel>[0] {
  return {
    homeDir: "/tmp/home",
    activeProject: {
      id: "p1",
      name: "Home",
      rootPath: "/tmp",
      createdAt: "2026-02-08T00:00:00.000Z",
      updatedAt: "2026-02-08T00:00:00.000Z",
      sessions: [],
    },
    activeSession: {
      id: "s1",
      title: "Session",
      agentId: "orchestrator",
      sessionKey: "desktop:p1:s1",
      createdAt: "2026-02-08T00:00:00.000Z",
      updatedAt: "2026-02-08T00:00:00.000Z",
      messages: [],
    },
    messages: [],
    runStatusEvents: [],
    gateway: {
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false,
    },
    error: null,
    busy: false,
    onSubmitMessage: vi.fn(async () => null),
    onStopMessage: vi.fn(async () => undefined),
    onOpenRuntimeSettings: vi.fn(),
    onOpenOnboarding: vi.fn(),
    onDismissError: vi.fn(),
    ...overrides,
  };
}

describe("ChatPanel", () => {
  it("renders provider failures as red inline error messages", () => {
    const messages: WorkbenchMessage[] = [
      {
        id: "m-user",
        role: "user",
        content: "hello",
        createdAt: "2026-02-08T00:00:00.000Z",
      },
      {
        id: "m-error",
        role: "assistant",
        content: "The provider quota or rate limit was exceeded.",
        createdAt: "2026-02-08T00:00:01.000Z",
        providerId: WORKBENCH_CHAT_ERROR_PROVIDER_ID,
      },
    ];

    render(
      createElement(ChatPanel, {
        homeDir: "/tmp/home",
        activeProject: {
          id: "p1",
          name: "Home",
          rootPath: "/tmp",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          sessions: [],
        },
        activeSession: {
          id: "s1",
          title: "Session",
          agentId: "orchestrator",
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          messages,
        },
        messages,
        runStatusEvents: [],
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false,
        },
        error: null,
        busy: false,
        onSubmitMessage: vi.fn(async () => null),
        onStopMessage: vi.fn(async () => undefined),
        onOpenRuntimeSettings: vi.fn(),
        onOpenOnboarding: vi.fn(),
        onDismissError: vi.fn(),
      })
    );

    expect(screen.getByText("Error")).toBeTruthy();
    const errorText = screen.getByText(/quota or rate limit was exceeded/i);
    expect(errorText.className).toContain("text-red-200");
  });

  it("shows orchestrator loading timeline while a run is in progress", () => {
    const messages: WorkbenchMessage[] = [
      {
        id: "m-user",
        role: "user",
        content: "hello",
        createdAt: "2026-02-08T00:00:00.000Z",
      },
    ];

    render(
      createElement(ChatPanel, {
        homeDir: "/tmp/home",
        activeProject: {
          id: "p1",
          name: "Home",
          rootPath: "/tmp",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          sessions: [],
        },
        activeSession: {
          id: "s1",
          title: "Session",
          agentId: "orchestrator",
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          messages,
        },
        messages,
        runStatusEvents: [
          {
            projectId: "p1",
            sessionId: "s1",
            stage: "run_started",
            timestamp: "2026-02-08T00:00:01.000Z",
            runId: "run-1",
            agentId: "orchestrator",
          },
          {
            projectId: "p1",
            sessionId: "s1",
            stage: "planner_started",
            timestamp: "2026-02-08T00:00:02.000Z",
            runId: "run-1",
            step: 1,
            agentId: "orchestrator",
          },
        ],
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false,
        },
        error: null,
        busy: true,
        onSubmitMessage: vi.fn(async () => null),
        onStopMessage: vi.fn(async () => undefined),
        onOpenRuntimeSettings: vi.fn(),
        onOpenOnboarding: vi.fn(),
        onDismissError: vi.fn(),
      }),
    );

    expect(screen.getByText("Request queued")).toBeTruthy();
    expect(screen.getAllByText("Awaiting final response").length).toBeGreaterThan(0);
  });

  it("labels assistant replies as orchestrator", () => {
    const messages: WorkbenchMessage[] = [
      {
        id: "m-assistant",
        role: "assistant",
        content: "Done.",
        createdAt: "2026-02-08T00:00:00.000Z",
      },
    ];

    render(
      createElement(ChatPanel, {
        homeDir: "/tmp/home",
        activeProject: {
          id: "p1",
          name: "Home",
          rootPath: "/tmp",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          sessions: [],
        },
        activeSession: {
          id: "s1",
          title: "Session",
          agentId: "orchestrator",
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          messages,
        },
        messages,
        runStatusEvents: [],
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false,
        },
        error: null,
        busy: false,
        onSubmitMessage: vi.fn(async () => null),
        onStopMessage: vi.fn(async () => undefined),
        onOpenRuntimeSettings: vi.fn(),
        onOpenOnboarding: vi.fn(),
        onDismissError: vi.fn(),
      }),
    );

    expect(screen.getByText("Orchestrator")).toBeTruthy();
    expect(screen.queryByText("Assistant")).toBeNull();
  });

  it("labels assistant replies with the active session agent", () => {
    const messages: WorkbenchMessage[] = [
      {
        id: "m-assistant",
        role: "assistant",
        content: "Done.",
        createdAt: "2026-02-08T00:00:00.000Z",
      },
    ];

    render(
      createElement(ChatPanel, {
        homeDir: "/tmp/home",
        activeProject: {
          id: "p1",
          name: "Home",
          rootPath: "/tmp",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          sessions: [],
        },
        activeSession: {
          id: "s1",
          title: "Session",
          agentId: "product-manager",
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          messages,
        },
        messages,
        runStatusEvents: [],
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false,
        },
        error: null,
        busy: false,
        onSubmitMessage: vi.fn(async () => null),
        onStopMessage: vi.fn(async () => undefined),
        onOpenRuntimeSettings: vi.fn(),
        onOpenOnboarding: vi.fn(),
        onDismissError: vi.fn(),
      }),
    );

    expect(screen.getByText("Product Manager")).toBeTruthy();
  });

  it("keeps run timeline after completion and collapses it", () => {
    const messages: WorkbenchMessage[] = [
      {
        id: "m-user",
        role: "user",
        content: "hello",
        createdAt: "2026-02-08T00:00:00.000Z",
      },
      {
        id: "m-assistant",
        role: "assistant",
        content: "done",
        createdAt: "2026-02-08T00:00:05.000Z",
      },
    ];

    render(
      createElement(ChatPanel, {
        homeDir: "/tmp/home",
        activeProject: {
          id: "p1",
          name: "Home",
          rootPath: "/tmp",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          sessions: [],
        },
        activeSession: {
          id: "s1",
          title: "Session",
          agentId: "orchestrator",
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          messages,
        },
        messages,
        runStatusEvents: [
          {
            projectId: "p1",
            sessionId: "s1",
            stage: "run_started",
            timestamp: "2026-02-08T00:00:01.000Z",
            runId: "run-1",
            agentId: "orchestrator",
          },
          {
            projectId: "p1",
            sessionId: "s1",
            stage: "planner_started",
            timestamp: "2026-02-08T00:00:02.000Z",
            runId: "run-1",
            step: 1,
            agentId: "orchestrator",
          },
          {
            projectId: "p1",
            sessionId: "s1",
            stage: "run_completed",
            timestamp: "2026-02-08T00:00:05.000Z",
            runId: "run-1",
            step: 1,
            agentId: "orchestrator",
          },
        ],
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false,
        },
        error: null,
        busy: false,
        onSubmitMessage: vi.fn(async () => null),
        onStopMessage: vi.fn(async () => undefined),
        onOpenRuntimeSettings: vi.fn(),
        onOpenOnboarding: vi.fn(),
        onDismissError: vi.fn(),
      }),
    );

    expect(screen.getByText("Response ready")).toBeTruthy();
    expect(screen.queryByText("Request queued")).toBeNull();
  });

  it("shows selected image attachments and enables submit without text", async () => {
    const onSubmitMessage = vi.fn(async () => ({
      id: "m-assistant",
      role: "assistant" as const,
      content: "Image received.",
      createdAt: "2026-02-08T00:00:10.000Z",
    }));

    const view = render(
      createElement(
        ChatPanel,
        createPanelProps({
          onSubmitMessage,
        }),
      ),
    );

    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton.hasAttribute("disabled")).toBe(true);

    const fileInput = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    if (!fileInput) {
      throw new Error("expected hidden file input");
    }

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["fake-image"], "diagram.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(screen.queryByText("diagram.png")).toBeTruthy();
    });
    expect(screen.getByText("diagram.png")).toBeTruthy();
    expect(submitButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a full-panel drop indicator while dragging image files", async () => {
    render(createElement(ChatPanel, createPanelProps()));

    fireEvent.dragEnter(window, {
      dataTransfer: {
        files: [new File(["fake-image"], "diagram.png", { type: "image/png" })],
        types: ["Files"],
      },
    });

    expect(await screen.findByText("Drop image here to attach")).toBeTruthy();

    fireEvent.dragLeave(window);
    await waitFor(() => {
      expect(screen.queryByText("Drop image here to attach")).toBeNull();
    });
  });
});
