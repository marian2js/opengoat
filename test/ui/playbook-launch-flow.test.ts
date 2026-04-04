import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const clientSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/lib/sidecar/client.ts"),
  "utf-8",
);

const dashboardSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx"),
  "utf-8",
);

const actionsSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/data/actions.ts"),
  "utf-8",
);

const playbookInputFormSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/PlaybookInputForm.tsx"),
  "utf-8",
);

const runContextBannerSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/chat/components/RunContextBanner.tsx"),
  "utf-8",
);

const chatWorkspaceSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx"),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/App.tsx"),
  "utf-8",
);

describe("ActionCard interface — playbookId field", () => {
  it("has optional playbookId field", () => {
    expect(actionsSrc).toContain("playbookId?: string");
  });

  it("launch-product-hunt maps to launch-pack", () => {
    expect(actionsSrc).toContain('playbookId: "launch-pack"');
  });

  it("rewrite-homepage-hero has no playbookId", () => {
    // Check that rewrite-homepage-hero block does NOT have playbookId
    const heroBlock = actionsSrc.slice(
      actionsSrc.indexOf('"rewrite-homepage-hero"'),
      actionsSrc.indexOf('"improve-homepage-conversion"'),
    );
    expect(heroBlock).not.toContain("playbookId");
  });
});

describe("SidecarClient — startPlaybook method", () => {
  it("has startPlaybook method", () => {
    expect(clientSrc).toContain("async startPlaybook(");
  });

  it("hits /playbooks/:playbookId/start endpoint", () => {
    expect(clientSrc).toContain("/start");
    expect(clientSrc).toContain("POST");
  });

  it("parses response with runRecordSchema", () => {
    // startPlaybook should parse as RunRecord
    expect(clientSrc).toContain("runRecordSchema.parse");
  });
});

describe("SidecarClient — getRunProgress method", () => {
  it("has getRunProgress method", () => {
    expect(clientSrc).toContain("async getRunProgress(");
  });

  it("hits /runs/:runId/progress endpoint", () => {
    expect(clientSrc).toContain("/progress");
  });

  it("exports PlaybookProgressResponse type", () => {
    expect(clientSrc).toContain("export interface PlaybookProgressResponse");
  });

  it("exports PhaseProgressDetail type", () => {
    expect(clientSrc).toContain("export interface PhaseProgressDetail");
  });
});

describe("PlaybookInputForm component", () => {
  it("renders as a Dialog", () => {
    expect(playbookInputFormSrc).toContain("Dialog");
    expect(playbookInputFormSrc).toContain("DialogContent");
  });

  it("renders required input fields", () => {
    expect(playbookInputFormSrc).toContain("requiredInputs.map");
  });

  it("renders optional input fields", () => {
    expect(playbookInputFormSrc).toContain("optionalInputs.map");
  });

  it("has a submit button with Start label", () => {
    expect(playbookInputFormSrc).toContain("Start");
    expect(playbookInputFormSrc).toContain('type="submit"');
  });

  it("validates required fields before allowing submit", () => {
    expect(playbookInputFormSrc).toContain("allRequiredFilled");
  });

  it("shows loading state during submission", () => {
    expect(playbookInputFormSrc).toContain("isSubmitting");
    expect(playbookInputFormSrc).toContain("Starting...");
  });

  it("accepts onSubmit callback with Record<string, string>", () => {
    expect(playbookInputFormSrc).toContain("onSubmit: (inputs: Record<string, string>)");
  });
});

describe("DashboardWorkspace — playbook launch flow", () => {
  it("imports PlaybookInputForm", () => {
    expect(dashboardSrc).toContain("PlaybookInputForm");
  });

  it("has playbook form state", () => {
    expect(dashboardSrc).toContain("playbookFormOpen");
    expect(dashboardSrc).toContain("pendingPlaybook");
  });

  it("has launchPlaybook handler that creates objective", () => {
    expect(dashboardSrc).toContain("launchPlaybook");
    expect(dashboardSrc).toContain("createObjective");
  });

  it("calls startPlaybook on the client", () => {
    expect(dashboardSrc).toContain("client.startPlaybook");
  });

  it("calls createSession for the new run", () => {
    expect(dashboardSrc).toContain("client.createSession");
  });

  it("composes a run prompt with playbook context", () => {
    expect(dashboardSrc).toContain("buildRunPrompt");
  });

  it("calls onRunSessionCreated after launch", () => {
    expect(dashboardSrc).toContain("onRunSessionCreated(session, finalPrompt, run.runId, objectiveId)");
  });

  it("intercepts action clicks to check for playbookId", () => {
    expect(dashboardSrc).toContain("handleActionOrPlaybookClick");
    expect(dashboardSrc).toContain("card?.playbookId");
  });

  it("fetches playbook manifest to get required inputs", () => {
    expect(dashboardSrc).toContain("client.getPlaybook(playbookId)");
  });

  it("shows input form when playbook has required inputs", () => {
    expect(dashboardSrc).toContain("setPlaybookFormOpen(true)");
  });

  it("launches immediately when no inputs required", () => {
    expect(dashboardSrc).toContain("launchPlaybook(manifest, {}, label)");
  });

  it("falls back to generic action flow on error", () => {
    // On fetch failure, falls back to onActionClick
    expect(dashboardSrc).toContain("onActionClick?.(actionId, prompt, label)");
  });
});

describe("RunContextBanner component", () => {
  it("fetches run progress from client", () => {
    expect(runContextBannerSrc).toContain("client.getRunProgress(runId)");
  });

  it("displays playbook title", () => {
    expect(runContextBannerSrc).toContain("progress.playbookTitle");
  });

  it("renders a phase stepper", () => {
    expect(runContextBannerSrc).toContain("PhaseStepper");
  });

  it("shows expected deliverables for current phase", () => {
    expect(runContextBannerSrc).toContain("deliverables");
    expect(runContextBannerSrc).toContain("expectedArtifacts");
  });

  it("auto-refreshes on interval", () => {
    expect(runContextBannerSrc).toContain("setInterval");
    expect(runContextBannerSrc).toContain("30_000");
  });

  it("renders phase status icons", () => {
    expect(runContextBannerSrc).toContain("CheckCircleIcon");
    expect(runContextBannerSrc).toContain("CircleDotIcon");
    expect(runContextBannerSrc).toContain("CircleIcon");
  });
});

describe("ChatWorkspace — RunContextBanner integration", () => {
  it("imports RunContextBanner", () => {
    expect(chatWorkspaceSrc).toContain("RunContextBanner");
  });

  it("renders RunContextBanner when scope is run", () => {
    expect(chatWorkspaceSrc).toContain('scope.type === "run"');
    expect(chatWorkspaceSrc).toContain("<RunContextBanner");
  });

  it("passes runId and client to RunContextBanner", () => {
    expect(chatWorkspaceSrc).toContain("runId={scope.runId}");
    expect(chatWorkspaceSrc).toContain("client={client}");
  });
});

describe("DashboardWorkspace — session label truncation (0008 fix)", () => {
  it("imports truncateSessionLabel utility", () => {
    expect(dashboardSrc).toContain("truncateSessionLabel");
  });

  it("applies truncateSessionLabel to the session label in createSession", () => {
    expect(dashboardSrc).toContain("label: truncateSessionLabel(objectiveTitle)");
  });

  it("still uses full objectiveTitle for objective creation", () => {
    expect(dashboardSrc).toContain("title: objectiveTitle");
  });
});

describe("truncateSessionLabel utility", () => {
  const sessionLabelSrc = readFileSync(
    resolve(__dirname, "../../apps/desktop/src/lib/utils/session-label.ts"),
    "utf-8",
  );

  it("exports truncateSessionLabel function", () => {
    expect(sessionLabelSrc).toContain("export function truncateSessionLabel");
  });

  it("defaults to 60-character max", () => {
    expect(sessionLabelSrc).toContain("maxLength = 60");
  });

  it("uses ellipsis character for truncation", () => {
    expect(sessionLabelSrc).toContain("…");
  });
});

describe("App.tsx — handleRunSessionCreated", () => {
  it("has handleRunSessionCreated callback", () => {
    expect(appSrc).toContain("handleRunSessionCreated");
  });

  it("sets pending chat scope with run type", () => {
    expect(appSrc).toContain('type: "run"');
    expect(appSrc).toContain("objectiveId");
    expect(appSrc).toContain("runId");
  });

  it("passes onRunSessionCreated to DashboardWorkspace", () => {
    expect(appSrc).toContain("onRunSessionCreated={handleRunSessionCreated}");
  });
});
