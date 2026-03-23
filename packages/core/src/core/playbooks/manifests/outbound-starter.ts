import type { PlaybookManifest } from "../domain/playbook.js";

export const outboundStarterPlaybook: PlaybookManifest = {
  playbookId: "outbound-starter",
  title: "Outbound Starter",
  description:
    "Build a cold outreach system from scratch: targeting angle, 4–5 email sequence, subject lines, personalization framework, and follow-up rules.",
  idealFor:
    "Founders starting outbound for the first time or pivoting to a new ICP segment.",
  goalTypes: ["outbound"],
  requiredInputs: [
    "ICP description (role, company size, industry)",
    "core value proposition",
  ],
  optionalInputs: [
    "existing outbound messaging that underperformed",
    "competitor positioning to differentiate from",
    "outreach tool (Apollo, Instantly, etc.)",
    "preferred tone (formal, casual, founder-to-founder)",
  ],
  skillRefs: ["cold-email", "email-sequence"],
  defaultPhases: [
    {
      name: "Research",
      description:
        "Define targeting angle, ICP pain points, and differentiation hooks.",
      expectedArtifacts: ["targeting angle"],
    },
    {
      name: "Draft",
      description:
        "Write 4–5 email sequence with subject lines and personalization tokens.",
      expectedArtifacts: [
        "email sequence",
        "subject lines",
        "personalization framework",
      ],
    },
    {
      name: "Review",
      description:
        "Review sequence for tone, specificity, and deliverability best practices.",
    },
    {
      name: "Refine",
      description:
        "Finalize follow-up rules and timing recommendations.",
      expectedArtifacts: ["follow-up rules"],
    },
  ],
  artifactTypes: [
    "targeting angle",
    "email sequence",
    "subject lines",
    "personalization framework",
    "follow-up rules",
  ],
  taskPolicy:
    "Create one task for the full sequence draft. Add review task after drafting.",
  approvalPolicy:
    "Sequence must be reviewed before being loaded into outreach tool.",
  evaluationRubric:
    "Score on: personalization depth, framework variety (PAS, BAB, etc.), subject line quality, realistic follow-up timing, avoidance of spam triggers.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "1 day",
  createsTrackedWork: true,
};
