import type { PlaybookManifest } from "../domain/playbook.js";

export const contentSprintPlaybook: PlaybookManifest = {
  playbookId: "content-sprint",
  title: "Content Sprint",
  description:
    "Go from zero to a 2-week content pipeline: content pillars, 10 ideas, 3 briefs, 1 draft, and a repurposing set.",
  idealFor:
    "Founders who know they need content but haven't started, or teams restarting content after a long pause.",
  goalTypes: ["content"],
  requiredInputs: [
    "product description",
    "target audience / ICP",
    "primary content channels (blog, LinkedIn, Twitter, etc.)",
  ],
  optionalInputs: [
    "existing content (URLs or descriptions)",
    "brand voice guidelines",
    "competitor content examples",
    "content goals (traffic, leads, authority)",
  ],
  skillRefs: ["content-strategy", "social-content", "marketing-ideas"],
  defaultPhases: [
    {
      name: "Research",
      description:
        "Define content pillars and research audience pain points, trending topics, and competitor gaps.",
      expectedArtifacts: ["content pillars"],
      specialistId: "content",
    },
    {
      name: "Ideation",
      description:
        "Generate 10 ranked content ideas with channel, format, and impact reasoning.",
      expectedArtifacts: ["10 content ideas"],
      specialistId: "content",
    },
    {
      name: "Draft",
      description:
        "Write 3 content briefs and 1 full draft for the highest-impact idea.",
      expectedArtifacts: ["3 content briefs", "1 full draft"],
      specialistId: "content",
    },
    {
      name: "Repurpose",
      description:
        "Create a repurposing set showing how the draft can be adapted across channels.",
      expectedArtifacts: ["repurposing set"],
      specialistId: "content",
    },
  ],
  artifactTypes: [
    "content pillars",
    "content ideas",
    "content briefs",
    "content draft",
    "repurposing set",
  ],
  taskPolicy:
    "Create a task per content brief. Create a separate task for the full draft.",
  approvalPolicy:
    "Content pillars should be confirmed before investing in briefs. Draft requires review before publishing.",
  evaluationRubric:
    "Score on: audience relevance, specificity of ideas (not generic), brief completeness, draft quality, repurposing creativity.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "2–3 days",
  createsTrackedWork: true,
};
