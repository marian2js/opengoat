import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bannerSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/components/ObjectiveBanner.tsx",
  ),
  "utf-8",
);

const pickerSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/components/ObjectivePicker.tsx",
  ),
  "utf-8",
);

const indicatorSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/components/ScopeIndicator.tsx",
  ),
  "utf-8",
);

const workspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx",
  ),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/App.tsx"),
  "utf-8",
);

describe("ObjectiveBanner component", () => {
  it("renders only for objective or run scope types", () => {
    // The component should return null for non-objective/run scopes
    expect(bannerSrc).toContain('scope.type !== "objective"');
    expect(bannerSrc).toContain('scope.type !== "run"');
    expect(bannerSrc).toContain("return null");
  });

  it("fetches objective detail via useObjectiveDetail", () => {
    expect(bannerSrc).toContain("useObjectiveDetail");
  });

  it("shows objective title", () => {
    expect(bannerSrc).toContain("objective.title");
  });

  it("shows run title when scope is run-scoped", () => {
    expect(bannerSrc).toContain("runTitle");
  });

  it("has Change Objective quick action", () => {
    expect(bannerSrc).toContain("Change Objective");
  });

  it("has Create Run quick action with correct navigation", () => {
    expect(bannerSrc).toContain("Create Run");
    expect(bannerSrc).toContain("#objective/");
    expect(bannerSrc).toContain("/runs");
  });

  it("has Open Board quick action with objective filter", () => {
    expect(bannerSrc).toContain("Open Board");
    expect(bannerSrc).toContain("#board?objective=");
  });

  it("has Open Artifacts quick action with correct navigation", () => {
    expect(bannerSrc).toContain("Open Artifacts");
    expect(bannerSrc).toContain("/artifacts");
  });

  it("shows error state when objective not found", () => {
    expect(bannerSrc).toContain("Scope invalid");
    expect(bannerSrc).toContain("Clear scope");
  });

  it("shows loading state while fetching", () => {
    expect(bannerSrc).toContain("Loading");
  });

  it("uses StatusDot to show objective status", () => {
    expect(bannerSrc).toContain("StatusDot");
  });
});

describe("ObjectivePicker component", () => {
  it("uses useObjectiveList to populate options", () => {
    expect(pickerSrc).toContain("useObjectiveList");
  });

  it("shows empty state when no objectives", () => {
    expect(pickerSrc).toContain("No objectives found");
  });

  it("has clear scope option", () => {
    expect(pickerSrc).toContain("Clear scope");
    expect(pickerSrc).toContain("onClear");
  });

  it("highlights current objective with CheckIcon", () => {
    expect(pickerSrc).toContain("CheckIcon");
    expect(pickerSrc).toContain("currentObjectiveId");
  });

  it("closes on Escape key", () => {
    expect(pickerSrc).toContain("Escape");
    expect(pickerSrc).toContain("onClose");
  });

  it("closes on click outside", () => {
    expect(pickerSrc).toContain("mousedown");
  });
});

describe("ScopeIndicator component", () => {
  it("returns null for unattached scope", () => {
    expect(indicatorSrc).toContain("unattached");
    expect(indicatorSrc).toContain("return null");
  });

  it("shows scope type and label", () => {
    expect(indicatorSrc).toContain("scopeDisplayLabel");
  });

  it("has a clear button", () => {
    expect(indicatorSrc).toContain("onClear");
    expect(indicatorSrc).toContain("Clear scope");
  });

  it("uses teal styling consistent with ObjectiveChip", () => {
    expect(indicatorSrc).toContain("bg-primary/8");
    expect(indicatorSrc).toContain("text-primary");
  });

  it("truncates long labels", () => {
    expect(indicatorSrc).toContain("truncate");
  });
});

describe("ChatWorkspace integration", () => {
  it("imports and uses useChatScope hook", () => {
    expect(workspaceSrc).toContain("useChatScope");
    expect(workspaceSrc).toContain("scope");
    expect(workspaceSrc).toContain("setScope");
    expect(workspaceSrc).toContain("clearScope");
  });

  it("renders ScopeIndicator in the agent bar", () => {
    expect(workspaceSrc).toContain("ScopeIndicator");
  });

  it("renders ObjectiveBanner between header and messages", () => {
    expect(workspaceSrc).toContain("ObjectiveBanner");
  });

  it("accepts initialScope prop", () => {
    expect(workspaceSrc).toContain("initialScope");
  });

  it("applies initial scope from props on mount", () => {
    expect(workspaceSrc).toContain("initialScopeAppliedRef");
    expect(workspaceSrc).toContain("onInitialScopeConsumed");
  });
});

describe("App.tsx scope integration", () => {
  it("imports ChatScope type", () => {
    expect(appSrc).toContain("ChatScope");
  });

  it("manages pendingChatScope state", () => {
    expect(appSrc).toContain("pendingChatScope");
    expect(appSrc).toContain("setPendingChatScope");
  });

  it("passes initialScope to ChatWorkspace", () => {
    expect(appSrc).toContain("initialScope={pendingChatScope}");
  });

  it("sets chat scope when run is created from dashboard", () => {
    // handleRunSessionCreated should set pendingChatScope with objective info
    expect(appSrc).toContain("setPendingChatScope");
    expect(appSrc).toMatch(/objectiveId.*runId/);
  });

  it("clears pending scope after consumption", () => {
    expect(appSrc).toContain("onInitialScopeConsumed");
    expect(appSrc).toContain("setPendingChatScope(null)");
  });
});
