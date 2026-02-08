/** @vitest-environment happy-dom */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WorkbenchMessage } from "@shared/workbench";
import { WORKBENCH_CHAT_ERROR_PROVIDER_ID } from "@shared/workbench";
import { ChatPanel } from "./chat-panel";

afterEach(() => {
  cleanup();
});

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
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false,
        },
        error: null,
        busy: false,
        onSubmitMessage: vi.fn(async () => null),
        onOpenRuntimeSettings: vi.fn(),
        onOpenOnboarding: vi.fn(),
        onDismissError: vi.fn(),
      })
    );

    expect(screen.getByText("Error")).toBeTruthy();
    const errorText = screen.getByText(/quota or rate limit was exceeded/i);
    expect(errorText.className).toContain("text-red-200");
  });
});
