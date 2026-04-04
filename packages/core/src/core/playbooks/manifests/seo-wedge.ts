import type { PlaybookManifest } from "../domain/playbook.js";

export const seoWedgePlaybook: PlaybookManifest = {
  playbookId: "seo-wedge-sprint",
  title: "SEO Wedge Sprint",
  description:
    "Find your best SEO entry point: a prioritized opportunity map, content wedge proposal, technical fix backlog, and initial topic cluster.",
  idealFor:
    "Startups with little organic traffic that need a focused, high-leverage SEO starting point rather than a broad strategy.",
  goalTypes: ["seo"],
  requiredInputs: [
    "website URL",
    "primary product category or problem space",
  ],
  optionalInputs: [
    "known competitor domains",
    "existing blog or content pages",
    "target geography",
    "business model (SaaS, marketplace, etc.)",
  ],
  skillRefs: ["seo-audit", "content-strategy", "schema-markup", "ai-seo"],
  defaultPhases: [
    {
      name: "Audit",
      description:
        "Run technical SEO audit, assess current indexation, and identify quick wins.",
      expectedArtifacts: ["SEO audit report"],
      specialistId: "seo-aeo",
    },
    {
      name: "Research",
      description:
        "Map keyword opportunities, competitor gaps, and AI search visibility.",
      expectedArtifacts: ["prioritized opportunity map"],
      specialistId: "seo-aeo",
    },
    {
      name: "Draft",
      description:
        "Propose a content wedge strategy and initial topic cluster.",
      expectedArtifacts: ["content wedge proposal", "initial topic cluster"],
      specialistId: "seo-aeo",
    },
    {
      name: "Refine",
      description:
        "Compile the technical fix backlog and finalize priorities.",
      expectedArtifacts: ["fix backlog"],
      specialistId: "seo-aeo",
    },
  ],
  artifactTypes: [
    "prioritized opportunity map",
    "content wedge proposal",
    "fix backlog",
    "initial topic cluster",
  ],
  taskPolicy:
    "Create tasks for technical fixes separately from content tasks. Prioritize quick wins first.",
  approvalPolicy:
    "Content wedge proposal should be approved before creating content tasks.",
  evaluationRubric:
    "Score on: opportunity specificity, realistic difficulty estimates, actionability of fix backlog, wedge focus (narrow > broad).",
  version: "1.0.0",
  source: "builtin",
  timeToFirstValue: "2–3 days",
  createsTrackedWork: true,
};
