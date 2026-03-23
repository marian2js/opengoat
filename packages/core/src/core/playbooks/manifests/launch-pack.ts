import type { PlaybookManifest } from "../domain/playbook.js";

export const launchPackPlaybook: PlaybookManifest = {
  playbookId: "launch-pack",
  title: "Launch Pack",
  description:
    "End-to-end launch preparation: Product Hunt copy, launch checklist, FAQ, community post angles, and asset inventory.",
  idealFor:
    "Teams preparing to launch on Product Hunt, Hacker News, or niche communities within the next 1–2 weeks.",
  goalTypes: ["launch"],
  requiredInputs: [
    "product name and one-line description",
    "target launch date or window",
    "primary launch platform (Product Hunt, HN, etc.)",
  ],
  optionalInputs: [
    "existing landing page URL",
    "competitor names",
    "unique differentiators",
    "founder story / backstory",
  ],
  skillRefs: ["launch-strategy", "marketing-ideas"],
  defaultPhases: [
    {
      name: "Research",
      description: "Identify best-fit launch surfaces, audience, and timing.",
      expectedArtifacts: ["community shortlist", "launch timing plan"],
    },
    {
      name: "Draft",
      description:
        "Write Product Hunt copy, FAQ, first-comment angles, and community post drafts.",
      expectedArtifacts: [
        "Product Hunt copy",
        "FAQ pack",
        "community post angles",
      ],
    },
    {
      name: "Review",
      description:
        "Present launch assets for founder review; incorporate feedback.",
      expectedArtifacts: ["revised launch copy"],
    },
    {
      name: "Finalize",
      description:
        "Compile final launch checklist and asset inventory.",
      expectedArtifacts: ["launch checklist", "launch assets list"],
    },
  ],
  artifactTypes: [
    "Product Hunt copy",
    "launch checklist",
    "FAQ pack",
    "community post angles",
    "launch assets list",
  ],
  taskPolicy:
    "Create one task per launch surface. Create a review task after drafts are complete.",
  approvalPolicy:
    "All launch copy must be approved by the founder before marking the run complete.",
  evaluationRubric:
    "Score on: copy specificity (no generic filler), audience fit, completeness of checklist, FAQ quality, and actionability of community angles.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "1–2 days",
  createsTrackedWork: true,
};
