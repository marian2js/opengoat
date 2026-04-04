import { describe, expect, it } from "vitest";
import {
  getPlaybookForAction,
  isPlaybookAction,
} from "../../apps/desktop/src/features/dashboard/lib/action-playbook-map";
import type { ActionCard } from "../../apps/desktop/src/features/dashboard/data/actions";
import { starterActions } from "../../apps/desktop/src/features/dashboard/data/actions";
import { SparklesIcon } from "lucide-react";

function makeCard(overrides?: Partial<ActionCard>): ActionCard {
  return {
    id: "test-action",
    title: "Test Action",
    promise: "Test promise",
    description: "Test description",
    icon: SparklesIcon,
    category: "growth",
    skills: [],
    prompt: "test prompt",
    timeToFirstOutput: "30s",
    createsTrackedWork: false,
    ...overrides,
  };
}

describe("getPlaybookForAction", () => {
  it("returns playbookId when present on card", () => {
    const card = makeCard({ playbookId: "launch-pack" });
    expect(getPlaybookForAction(card)).toBe("launch-pack");
  });

  it("returns undefined when no playbookId on card", () => {
    const card = makeCard();
    expect(getPlaybookForAction(card)).toBeUndefined();
  });

  it("returns undefined for rewrite-homepage-hero (one-shot action)", () => {
    const card = starterActions.find((a) => a.id === "rewrite-homepage-hero");
    expect(card).toBeDefined();
    expect(getPlaybookForAction(card!)).toBeUndefined();
  });
});

describe("isPlaybookAction", () => {
  it("returns true for card with playbookId", () => {
    const card = makeCard({ playbookId: "seo-wedge-sprint" });
    expect(isPlaybookAction(card)).toBe(true);
  });

  it("returns false for card without playbookId", () => {
    const card = makeCard();
    expect(isPlaybookAction(card)).toBe(false);
  });
});

describe("starterActions playbookId mappings", () => {
  it("maps launch-product-hunt to launch-pack", () => {
    const card = starterActions.find((a) => a.id === "launch-product-hunt");
    expect(card?.playbookId).toBe("launch-pack");
  });

  it("maps improve-homepage-conversion to homepage-conversion-sprint", () => {
    const card = starterActions.find((a) => a.id === "improve-homepage-conversion");
    expect(card?.playbookId).toBe("homepage-conversion-sprint");
  });

  it("maps build-outbound-sequence to outbound-starter", () => {
    const card = starterActions.find((a) => a.id === "build-outbound-sequence");
    expect(card?.playbookId).toBe("outbound-starter");
  });

  it("maps find-seo-quick-wins to seo-wedge-sprint", () => {
    const card = starterActions.find((a) => a.id === "find-seo-quick-wins");
    expect(card?.playbookId).toBe("seo-wedge-sprint");
  });

  it("maps generate-founder-content-ideas to content-sprint", () => {
    const card = starterActions.find((a) => a.id === "generate-founder-content-ideas");
    expect(card?.playbookId).toBe("content-sprint");
  });

  it("maps create-comparison-page-outline to comparison-page-sprint", () => {
    const card = starterActions.find((a) => a.id === "create-comparison-page-outline");
    expect(card?.playbookId).toBe("comparison-page-sprint");
  });

  it("maps create-lead-magnet-ideas to lead-magnet-sprint", () => {
    const card = starterActions.find((a) => a.id === "create-lead-magnet-ideas");
    expect(card?.playbookId).toBe("lead-magnet-sprint");
  });

  it("does NOT map rewrite-homepage-hero (one-shot action)", () => {
    const card = starterActions.find((a) => a.id === "rewrite-homepage-hero");
    expect(card?.playbookId).toBeUndefined();
  });

  it("7 of 8 starter actions have playbookIds", () => {
    const withPlaybook = starterActions.filter((a) => a.playbookId);
    expect(withPlaybook).toHaveLength(7);
  });
});
