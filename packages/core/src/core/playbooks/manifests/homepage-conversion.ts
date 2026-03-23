import type { PlaybookManifest } from "../domain/playbook.js";

export const homepageConversionPlaybook: PlaybookManifest = {
  playbookId: "homepage-conversion-sprint",
  title: "Homepage Conversion Sprint",
  description:
    "Audit your homepage for conversion blockers, then produce hero rewrites, CTA options, trust section copy, and a prioritized recommendations backlog.",
  idealFor:
    "Founders who have traffic but low signup or demo-request rates, or teams about to redesign their homepage.",
  goalTypes: ["conversion"],
  requiredInputs: [
    "homepage URL",
    "primary conversion goal (signup, demo, purchase)",
  ],
  optionalInputs: [
    "current conversion rate or benchmark",
    "ICP description",
    "competitor homepage URLs",
    "brand voice guidelines",
  ],
  skillRefs: ["copywriting", "page-cro"],
  defaultPhases: [
    {
      name: "Audit",
      description:
        "Analyze homepage across 7 CRO dimensions: value prop clarity, headline effectiveness, CTA placement, visual hierarchy, trust signals, objection handling, friction points.",
      expectedArtifacts: ["CRO audit report"],
    },
    {
      name: "Draft",
      description:
        "Write hero variants, CTA options, trust section rewrites, and objection-handling copy.",
      expectedArtifacts: [
        "hero options",
        "CTA options",
        "trust section rewrite",
        "objection handling copy",
      ],
    },
    {
      name: "Review",
      description:
        "Present options with before/after framing; collect founder preferences.",
    },
    {
      name: "Refine",
      description:
        "Deliver final copy and a prioritized page recommendations backlog.",
      expectedArtifacts: ["page recommendations backlog"],
    },
  ],
  artifactTypes: [
    "hero options",
    "CTA options",
    "trust section rewrite",
    "objection handling copy",
    "page recommendations backlog",
  ],
  taskPolicy:
    "Create a task per page section being rewritten. Add a review task after draft phase.",
  approvalPolicy:
    "Hero copy must be approved before moving to supporting sections.",
  evaluationRubric:
    "Score on: specificity to the product (not generic), ICP alignment, variety of approaches, actionability of backlog items.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "1–2 days",
  createsTrackedWork: true,
};
