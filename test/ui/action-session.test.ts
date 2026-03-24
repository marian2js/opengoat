import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveActionSessionState,
  extractOutputs,
} from "../../apps/desktop/src/features/action-session/lib/action-session-state";

// ── Helper to read source files ──
const featureDir = resolve(
  __dirname,
  "../../apps/desktop/src/features/action-session",
);
const readSrc = (path: string) =>
  readFileSync(resolve(featureDir, path), "utf-8");

const appSrc = () =>
  readFileSync(
    resolve(__dirname, "../../apps/desktop/src/app/App.tsx"),
    "utf-8",
  );

// ═══════════════════════════════════════════════════════
// 1. deriveActionSessionState — pure function tests
// ═══════════════════════════════════════════════════════

describe("deriveActionSessionState", () => {
  const textMsg = (text: string) => ({
    role: "assistant",
    parts: [{ type: "text", text }],
  });
  const userMsg = (text: string) => ({
    role: "user",
    parts: [{ type: "text", text }],
  });
  const thinkingMsg = () => ({
    role: "assistant",
    parts: [{ type: "reasoning", text: "thinking..." }],
  });

  it("returns 'starting' when no assistant messages exist", () => {
    expect(deriveActionSessionState("submitted", [], false)).toBe("starting");
  });

  it("returns 'starting' when only reasoning/thinking messages exist", () => {
    expect(
      deriveActionSessionState("streaming", [thinkingMsg()], false),
    ).toBe("starting");
  });

  it("returns 'working' when streaming with assistant text", () => {
    expect(
      deriveActionSessionState(
        "streaming",
        [textMsg("Here are some ideas...")],
        false,
      ),
    ).toBe("working");
  });

  it("returns 'working' when submitted with assistant text", () => {
    expect(
      deriveActionSessionState(
        "submitted",
        [textMsg("Working on it...")],
        false,
      ),
    ).toBe("working");
  });

  it("returns 'needs-input' when last assistant message ends with question mark", () => {
    expect(
      deriveActionSessionState(
        "ready",
        [textMsg("What audience are you targeting?")],
        false,
      ),
    ).toBe("needs-input");
  });

  it("returns 'ready-to-review' when chat is ready and outputs exist", () => {
    expect(
      deriveActionSessionState(
        "ready",
        [textMsg("Here are 3 hero variants for your homepage.")],
        false,
      ),
    ).toBe("ready-to-review");
  });

  it("returns 'saved-to-board' when savedToBoard is true", () => {
    expect(
      deriveActionSessionState(
        "ready",
        [textMsg("Done!")],
        true,
      ),
    ).toBe("saved-to-board");
  });

  it("returns 'saved-to-board' even when still streaming if savedToBoard is true", () => {
    expect(
      deriveActionSessionState(
        "streaming",
        [textMsg("Still generating...")],
        true,
      ),
    ).toBe("saved-to-board");
  });

  it("handles mixed user and assistant messages correctly", () => {
    const messages = [
      userMsg("Help me with homepage"),
      textMsg("What tone do you prefer?"),
      userMsg("Professional"),
      textMsg("Here are your options."),
    ];
    expect(deriveActionSessionState("ready", messages, false)).toBe(
      "ready-to-review",
    );
  });

  it("detects needs-input from multi-part assistant message", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          { type: "text", text: "I can help with that." },
          { type: "text", text: "Which competitor matters most?" },
        ],
      },
    ];
    expect(deriveActionSessionState("ready", messages, false)).toBe(
      "needs-input",
    );
  });
});

// ═══════════════════════════════════════════════════════
// 2. extractOutputs — message parsing tests
// ═══════════════════════════════════════════════════════

describe("extractOutputs", () => {
  it("returns empty array for no messages", () => {
    expect(extractOutputs([])).toEqual([]);
  });

  it("skips user messages", () => {
    const messages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Hello" }] },
    ];
    expect(extractOutputs(messages)).toEqual([]);
  });

  it("extracts text from assistant messages", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Here are your results" }],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.content).toBe("Here are your results");
    expect(outputs[0]!.messageId).toBe("a1");
  });

  it("derives title from markdown heading", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "## Hero Option 1\nGreat headline here" }],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs[0]!.title).toBe("Hero Option 1");
  });

  it("derives title from first line when no heading", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Here are 3 options\nOption 1\nOption 2" }],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs[0]!.title).toBe("Here are 3 options");
  });

  it("handles multiple text parts in one message", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Part one content" },
          { type: "text", text: "Part two content" },
        ],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs).toHaveLength(2);
    expect(outputs[0]!.id).toBe("a1-0");
    expect(outputs[1]!.id).toBe("a1-1");
  });

  it("skips empty or whitespace-only text parts", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "   " },
          { type: "text", text: "Real content" },
        ],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.content).toBe("Real content");
  });

  it("skips non-text parts", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "thinking..." },
          { type: "text", text: "Actual output" },
        ],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs).toHaveLength(1);
  });

  it("handles multiple messages", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "First response" }],
      },
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Thanks" }],
      },
      {
        id: "a2",
        role: "assistant",
        parts: [{ type: "text", text: "Second response" }],
      },
    ];
    const outputs = extractOutputs(messages);
    expect(outputs).toHaveLength(2);
    expect(outputs[0]!.messageId).toBe("a1");
    expect(outputs[1]!.messageId).toBe("a2");
  });
});

// ═══════════════════════════════════════════════════════
// 3. ActionSessionView component structure tests
// ═══════════════════════════════════════════════════════

describe("ActionSessionView component structure", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/ActionSessionView.tsx")),
    ).toBe(true);
  });

  it("imports useChat from @ai-sdk/react", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("useChat");
  });

  it("imports chatCache infrastructure", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("chatCache");
  });

  it("imports deriveActionSessionState", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("deriveActionSessionState");
  });

  it("renders ActionSessionHeader", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("ActionSessionHeader");
  });

  it("renders ActionSessionProgress", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("ActionSessionProgress");
  });

  it("renders ActionSessionOutputs", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("ActionSessionOutputs");
  });

  it("renders ActionSessionInput when needs-input", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("ActionSessionInput");
  });

  it("renders SaveToBoardControls", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("SaveToBoardControls");
  });

  it("renders ActionSessionFooter", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("ActionSessionFooter");
  });

  it("auto-sends pendingActionPrompt on mount", () => {
    const src = readSrc("components/ActionSessionView.tsx");
    expect(src).toContain("pendingActionPrompt");
    expect(src).toContain("sendMessage");
  });
});

// ═══════════════════════════════════════════════════════
// 4. ActionSessionHeader component tests
// ═══════════════════════════════════════════════════════

describe("ActionSessionHeader", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/ActionSessionHeader.tsx")),
    ).toBe(true);
  });

  it("renders action title", () => {
    const src = readSrc("components/ActionSessionHeader.tsx");
    expect(src).toContain("actionTitle");
  });

  it("renders state badge", () => {
    const src = readSrc("components/ActionSessionHeader.tsx");
    expect(src).toContain("state");
  });
});

// ═══════════════════════════════════════════════════════
// 5. ActionSessionProgress tests
// ═══════════════════════════════════════════════════════

describe("ActionSessionProgress", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/ActionSessionProgress.tsx")),
    ).toBe(true);
  });

  it("shows progress for starting state", () => {
    const src = readSrc("components/ActionSessionProgress.tsx");
    expect(src).toContain("starting");
  });

  it("shows working indicator", () => {
    const src = readSrc("components/ActionSessionProgress.tsx");
    expect(src).toContain("working");
  });
});

// ═══════════════════════════════════════════════════════
// 6. ActionSessionOutputs tests
// ═══════════════════════════════════════════════════════

describe("ActionSessionOutputs", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/ActionSessionOutputs.tsx")),
    ).toBe(true);
  });

  it("renders output blocks as cards", () => {
    const src = readSrc("components/ActionSessionOutputs.tsx");
    expect(src).toContain("OutputBlock");
  });

  it("has copy functionality", () => {
    const src = readSrc("components/ActionSessionOutputs.tsx");
    expect(src).toContain("clipboard");
  });
});

// ═══════════════════════════════════════════════════════
// 7. ActionSessionInput tests
// ═══════════════════════════════════════════════════════

describe("ActionSessionInput", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/ActionSessionInput.tsx")),
    ).toBe(true);
  });

  it("has input field and submit", () => {
    const src = readSrc("components/ActionSessionInput.tsx");
    expect(src).toContain("onSubmit");
  });
});

// ═══════════════════════════════════════════════════════
// 8. SaveToBoardControls tests
// ═══════════════════════════════════════════════════════

describe("SaveToBoardControls", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/SaveToBoardControls.tsx")),
    ).toBe(true);
  });

  it("has Save to Board button", () => {
    const src = readSrc("components/SaveToBoardControls.tsx");
    expect(src).toContain("Save to Board");
  });

  it("has skip option", () => {
    const src = readSrc("components/SaveToBoardControls.tsx");
    expect(src).toContain("done");
  });
});

// ═══════════════════════════════════════════════════════
// 9. ActionSessionFooter tests
// ═══════════════════════════════════════════════════════

describe("ActionSessionFooter", () => {
  it("exists as a component file", () => {
    expect(
      existsSync(resolve(featureDir, "components/ActionSessionFooter.tsx")),
    ).toBe(true);
  });

  it("has link to view full chat", () => {
    const src = readSrc("components/ActionSessionFooter.tsx");
    expect(src).toContain("chat");
  });

  it("has link back to dashboard", () => {
    const src = readSrc("components/ActionSessionFooter.tsx");
    expect(src).toContain("dashboard");
  });
});

// ═══════════════════════════════════════════════════════
// 10. App.tsx routing integration tests
// ═══════════════════════════════════════════════════════

describe("App.tsx routing for action-session", () => {
  it("includes action-session in AppView type", () => {
    const src = appSrc();
    expect(src).toContain("action-session");
  });

  it("handles #action-session hash route", () => {
    const src = appSrc();
    expect(src).toContain("#action-session");
  });

  it("renders ActionSessionView for action-session route", () => {
    const src = appSrc();
    expect(src).toContain("ActionSessionView");
  });

  it("navigates to action-session from handleActionClick", () => {
    const src = appSrc();
    // The handler should now navigate to #action-session
    expect(src).toContain('#action-session');
  });
});

// ═══════════════════════════════════════════════════════
// 11. Free-text routing through action session
// ═══════════════════════════════════════════════════════

describe("Free-text routing through action session", () => {
  it("FreeTextInput submit routes through action session flow", () => {
    const dashSrc = readFileSync(
      resolve(
        __dirname,
        "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx",
      ),
      "utf-8",
    );
    // The handleFreeTextSubmit should still call onActionClick which now routes to action-session
    expect(dashSrc).toContain("onActionClick");
    expect(dashSrc).toContain("handleFreeTextSubmit");
  });
});

// ═══════════════════════════════════════════════════════
// 12. NowWorkingOn resume routes to action-session
// ═══════════════════════════════════════════════════════

describe("NowWorkingOn resume uses action-session view", () => {
  it("App.tsx handleResumeRun checks for action sessions", () => {
    const src = appSrc();
    expect(src).toContain("isActionSession");
  });
});

// ═══════════════════════════════════════════════════════
// 13. Types module
// ═══════════════════════════════════════════════════════

describe("Action session types", () => {
  it("types file exists", () => {
    expect(existsSync(resolve(featureDir, "types.ts"))).toBe(true);
  });

  it("exports ActionSessionState type", () => {
    const src = readSrc("types.ts");
    expect(src).toContain("ActionSessionState");
  });

  it("defines all 6 states", () => {
    const src = readSrc("types.ts");
    expect(src).toContain("starting");
    expect(src).toContain("working");
    expect(src).toContain("needs-input");
    expect(src).toContain("ready-to-review");
    expect(src).toContain("saved-to-board");
    expect(src).toContain("done");
  });

  it("exports OutputBlock type", () => {
    const src = readSrc("types.ts");
    expect(src).toContain("OutputBlock");
  });
});
