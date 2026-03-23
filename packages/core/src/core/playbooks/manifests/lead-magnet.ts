import type { PlaybookManifest } from "../domain/playbook.js";

export const leadMagnetPlaybook: PlaybookManifest = {
  playbookId: "lead-magnet-sprint",
  title: "Lead Magnet Sprint",
  description:
    "Design and outline a high-converting lead magnet: evaluate options, write the chosen brief, outline a landing page, and draft a nurture sequence.",
  idealFor:
    "Teams that need to capture emails or leads but don't have a compelling opt-in offer yet.",
  goalTypes: ["lead-gen"],
  requiredInputs: [
    "product description",
    "target audience / ICP",
    "primary pain point the lead magnet should address",
  ],
  optionalInputs: [
    "existing lead magnets (if any)",
    "preferred format (PDF, checklist, template, calculator, quiz)",
    "email tool (ConvertKit, Mailchimp, etc.)",
    "landing page builder",
  ],
  skillRefs: ["content-strategy", "copywriting", "page-cro"],
  defaultPhases: [
    {
      name: "Ideation",
      description:
        "Generate 5–7 lead magnet options scored by audience fit, production effort, and conversion potential.",
      expectedArtifacts: ["lead magnet options"],
    },
    {
      name: "Brief",
      description:
        "Write a detailed brief for the chosen lead magnet: outline, key sections, value hooks.",
      expectedArtifacts: ["chosen lead magnet brief"],
    },
    {
      name: "Landing Page",
      description:
        "Draft a landing page outline with headline, value prop, social proof, and CTA.",
      expectedArtifacts: ["landing page outline"],
    },
    {
      name: "Nurture",
      description:
        "Draft a 3–5 email nurture sequence for post-download engagement.",
      expectedArtifacts: ["nurture sequence draft"],
    },
  ],
  artifactTypes: [
    "lead magnet options",
    "lead magnet brief",
    "landing page outline",
    "nurture sequence draft",
  ],
  taskPolicy:
    "Create a task for the lead magnet content itself and a separate task for the landing page.",
  approvalPolicy:
    "Lead magnet choice must be confirmed before investing in the brief and landing page.",
  evaluationRubric:
    "Score on: audience-problem fit, perceived value of the magnet, landing page conversion potential, nurture sequence relevance.",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "2–3 days",
  createsTrackedWork: true,
};
