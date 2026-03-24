import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const playbookCardSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/PlaybookCard.tsx",
  ),
  "utf-8",
);

const playbookLibrarySrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/PlaybookLibrary.tsx",
  ),
  "utf-8",
);

const playbookStartDialogSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/PlaybookStartDialog.tsx",
  ),
  "utf-8",
);

const dashboardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx",
  ),
  "utf-8",
);

describe("PlaybookCard", () => {
  it("renders playbook title", () => {
    expect(playbookCardSrc).toContain("playbook.title");
  });

  it("renders playbook description", () => {
    expect(playbookCardSrc).toContain("playbook.description");
  });

  it("renders goal type badges", () => {
    expect(playbookCardSrc).toContain("playbook.goalTypes.map");
  });

  it("renders time to first value", () => {
    expect(playbookCardSrc).toContain("playbook.timeToFirstValue");
  });

  it("renders tracked work indicator", () => {
    expect(playbookCardSrc).toContain("playbook.createsTrackedWork");
    expect(playbookCardSrc).toContain("Creates tasks");
  });

  it("renders deliverable count", () => {
    expect(playbookCardSrc).toContain("playbook.artifactTypes.length");
    expect(playbookCardSrc).toContain("deliverables");
  });

  it("has a start playbook CTA", () => {
    expect(playbookCardSrc).toContain("Start playbook");
  });

  it("fires onClick handler when clicked", () => {
    expect(playbookCardSrc).toContain("onClick?.(playbook)");
  });

  it("has goal-type-specific accent colors", () => {
    expect(playbookCardSrc).toContain("GOAL_TYPE_STYLES");
    // Check that all 8 goal types have style entries (keys may be unquoted for valid identifiers)
    for (const goalType of [
      "launch",
      "conversion",
      "outbound",
      "seo",
      "content",
      "competitive",
      "lead-gen",
      "onboarding",
    ]) {
      expect(playbookCardSrc).toContain(goalType);
    }
  });

  it("uses the category accent left border pattern", () => {
    expect(playbookCardSrc).toContain("w-[3px]");
    expect(playbookCardSrc).toContain("accentColor");
  });
});

describe("PlaybookLibrary", () => {
  it("renders a section label with BookOpenIcon", () => {
    expect(playbookLibrarySrc).toContain("BookOpenIcon");
    expect(playbookLibrarySrc).toContain("Playbook Library");
  });

  it("renders a loading skeleton", () => {
    expect(playbookLibrarySrc).toContain("isLoading");
    expect(playbookLibrarySrc).toContain("Skeleton");
  });

  it("returns null when no playbooks", () => {
    expect(playbookLibrarySrc).toContain("playbooks.length === 0");
    expect(playbookLibrarySrc).toContain("return null");
  });

  it("renders playbook cards in a grid", () => {
    expect(playbookLibrarySrc).toContain("PlaybookCard");
    expect(playbookLibrarySrc).toContain("grid");
    expect(playbookLibrarySrc).toContain("playbooks.map");
  });

  it("renders the PlaybookStartDialog", () => {
    expect(playbookLibrarySrc).toContain("PlaybookStartDialog");
    expect(playbookLibrarySrc).toContain("dialogOpen");
    expect(playbookLibrarySrc).toContain("selectedPlaybook");
  });

  it("uses responsive grid columns", () => {
    expect(playbookLibrarySrc).toContain("sm:grid-cols-2");
    expect(playbookLibrarySrc).toContain("xl:grid-cols-3");
  });
});

describe("PlaybookStartDialog", () => {
  it("shows playbook title and description", () => {
    expect(playbookStartDialogSrc).toContain("playbook.title");
    expect(playbookStartDialogSrc).toContain("playbook.description");
  });

  it("shows the ideal-for section", () => {
    expect(playbookStartDialogSrc).toContain("Best for");
    expect(playbookStartDialogSrc).toContain("playbook.idealFor");
  });

  it("renders phases as a numbered list", () => {
    expect(playbookStartDialogSrc).toContain("Phases");
    expect(playbookStartDialogSrc).toContain("playbook.defaultPhases.map");
    expect(playbookStartDialogSrc).toContain("phase.name");
    expect(playbookStartDialogSrc).toContain("phase.description");
  });

  it("renders expected deliverables", () => {
    expect(playbookStartDialogSrc).toContain("Expected deliverables");
    expect(playbookStartDialogSrc).toContain("playbook.artifactTypes.map");
  });

  it("has a Start playbook button", () => {
    expect(playbookStartDialogSrc).toContain("Start playbook");
    expect(playbookStartDialogSrc).toContain("PlayIcon");
  });

  it("calls onStart when clicking the start button", () => {
    expect(playbookStartDialogSrc).toContain("onStart?.(playbook)");
  });

  it("disables start button while starting", () => {
    expect(playbookStartDialogSrc).toContain("disabled={isStarting}");
  });

  it("returns null when no playbook is selected", () => {
    expect(playbookStartDialogSrc).toContain("if (!playbook) return null");
  });
});

// Sprint 5: PlaybookLibrary removed from dashboard default flow.
// Playbooks are demoted; actions replace playbooks as the entry point.
describe("DashboardWorkspace integration", () => {
  it("does not import PlaybookLibrary (Sprint 5 simplification)", () => {
    expect(dashboardWorkspaceSrc).not.toContain("PlaybookLibrary");
  });

  it("does not use usePlaybooks hook", () => {
    expect(dashboardWorkspaceSrc).not.toContain("usePlaybooks");
  });
});
