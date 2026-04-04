import type { PlaybookManifest } from "../domain/playbook.js";

export const comparisonPagePlaybook: PlaybookManifest = {
  playbookId: "comparison-page-sprint",
  title: "Comparison Page Sprint",
  description:
    "Build comparison content that converts: competitor matrix, messaging gaps analysis, comparison page outline, and priority targeting.",
  idealFor:
    "Teams in competitive markets where buyers actively compare alternatives before purchasing.",
  goalTypes: ["competitive"],
  requiredInputs: [
    "product name and positioning",
    "top 2–4 competitor names",
  ],
  optionalInputs: [
    "competitor URLs",
    "known feature advantages and disadvantages",
    "target search queries (e.g., 'X vs Y')",
    "existing comparison content",
  ],
  skillRefs: ["competitor-alternatives", "marketing-psychology"],
  defaultPhases: [
    {
      name: "Research",
      description:
        "Analyze competitor positioning, messaging themes, strengths, and weaknesses.",
      expectedArtifacts: ["competitor matrix"],
      specialistId: "market-intel",
    },
    {
      name: "Analyze",
      description:
        "Identify messaging gaps, unoccupied positions, and counter-positioning opportunities.",
      expectedArtifacts: ["messaging gaps"],
      specialistId: "positioning",
    },
    {
      name: "Draft",
      description:
        "Create comparison page outline with sections, copy angles, and proof points.",
      expectedArtifacts: ["comparison page outline"],
      specialistId: "seo-aeo",
    },
    {
      name: "Prioritize",
      description:
        "Rank comparison targets by search volume, win rate impact, and content effort.",
      expectedArtifacts: ["priority comparison targets"],
      specialistId: "seo-aeo",
    },
  ],
  artifactTypes: [
    "competitor matrix",
    "messaging gaps",
    "comparison page outline",
    "priority comparison targets",
  ],
  taskPolicy:
    "Create one task per competitor comparison page. Prioritize the most-searched matchup first.",
  approvalPolicy:
    "Competitor matrix must be reviewed for accuracy before drafting comparison pages.",
  evaluationRubric:
    "Score on: factual accuracy, fair but persuasive framing, SEO opportunity sizing, actionability of outline.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "2 days",
  createsTrackedWork: true,
};
