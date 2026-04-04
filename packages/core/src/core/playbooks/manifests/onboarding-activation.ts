import type { PlaybookManifest } from "../domain/playbook.js";

export const onboardingActivationPlaybook: PlaybookManifest = {
  playbookId: "onboarding-activation-pass",
  title: "Onboarding Activation Pass",
  description:
    "Find and fix what blocks new users: friction audit, aha-moment framing, onboarding copy fixes, and an activation task backlog.",
  idealFor:
    "Products with signups but poor activation — users sign up then never come back.",
  goalTypes: ["onboarding"],
  requiredInputs: [
    "product URL or app access",
    "signup flow description (steps, fields, auth methods)",
  ],
  optionalInputs: [
    "current signup-to-active conversion rate",
    "defined 'aha moment' (if known)",
    "onboarding email sequence (if any)",
    "analytics tool and key metrics",
  ],
  skillRefs: ["signup-flow-cro", "onboarding-cro"],
  defaultPhases: [
    {
      name: "Audit",
      description:
        "Walk through the signup and onboarding flow, identify friction points and drop-off risks.",
      expectedArtifacts: ["friction list"],
      specialistId: "website-conversion",
    },
    {
      name: "Analyze",
      description:
        "Define the aha moment, map the activation path, and identify the shortest route to value.",
      expectedArtifacts: ["aha moment framing"],
      specialistId: "website-conversion",
    },
    {
      name: "Draft",
      description:
        "Write specific onboarding copy fixes, empty-state improvements, and tooltip/guide suggestions.",
      expectedArtifacts: ["onboarding fixes"],
      specialistId: "website-conversion",
    },
    {
      name: "Backlog",
      description:
        "Compile a prioritized activation task backlog with effort and impact estimates.",
      expectedArtifacts: ["activation task backlog"],
      specialistId: "website-conversion",
    },
  ],
  artifactTypes: [
    "friction list",
    "aha moment framing",
    "onboarding fixes",
    "activation task backlog",
  ],
  taskPolicy:
    "Create tasks grouped by signup flow vs. post-signup experience. Prioritize quick wins.",
  approvalPolicy:
    "Friction list should be reviewed before committing to fix implementation.",
  evaluationRubric:
    "Score on: specificity of friction points (not vague), aha moment clarity, fix actionability, backlog prioritization quality.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "1–2 days",
  createsTrackedWork: true,
};
