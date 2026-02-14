export type SkillRegistryStatus = "available" | "coming-soon";

export interface SkillRegistryEntry {
  id: string;
  name: string;
  description: string;
  assignedCount: number;
  category: string;
  status: SkillRegistryStatus;
  imageUrl: string;
}

// Developer note:
// Add/edit skills in this registry only. The Skills page renders from this data.
export const SKILL_REGISTRY: SkillRegistryEntry[] = [
  {
    id: "market-radar",
    name: "Market Radar",
    description:
      "Tracks market movement and creates short opportunity briefs for the team.",
    assignedCount: 9,
    category: "Research",
    status: "available",
    imageUrl: createSkillCardImageDataUri("market radar", "#1D4ED8", "#0891B2"),
  },
  {
    id: "spec-writer",
    name: "Spec Writer",
    description:
      "Drafts clear technical specs with acceptance criteria and rollout notes.",
    assignedCount: 14,
    category: "Planning",
    status: "available",
    imageUrl: createSkillCardImageDataUri("spec writer", "#4C1D95", "#7C3AED"),
  },
  {
    id: "incident-triage",
    name: "Incident Triage",
    description:
      "Classifies incidents by urgency and routes ownership to the right responders.",
    assignedCount: 6,
    category: "Operations",
    status: "available",
    imageUrl: createSkillCardImageDataUri(
      "incident triage",
      "#7F1D1D",
      "#DC2626",
    ),
  },
  {
    id: "code-review",
    name: "Code Review",
    description:
      "Performs structured pull request checks with risk scoring and action items.",
    assignedCount: 18,
    category: "Engineering",
    status: "available",
    imageUrl: createSkillCardImageDataUri("code review", "#0F766E", "#10B981"),
  },
  {
    id: "release-pilot",
    name: "Release Pilot",
    description:
      "Runs release checklists, validates artifacts, and coordinates launch windows.",
    assignedCount: 7,
    category: "Delivery",
    status: "available",
    imageUrl: createSkillCardImageDataUri(
      "release pilot",
      "#0F172A",
      "#334155",
    ),
  },
  {
    id: "customer-voice",
    name: "Customer Voice",
    description:
      "Summarizes support threads into concise product feedback and recommendation notes.",
    assignedCount: 11,
    category: "Product",
    status: "available",
    imageUrl: createSkillCardImageDataUri(
      "customer voice",
      "#9A3412",
      "#EA580C",
    ),
  },
  {
    id: "roadmap-planner",
    name: "Roadmap Planner",
    description:
      "Builds quarter plans with milestones, dependencies, and realistic sequencing.",
    assignedCount: 5,
    category: "Leadership",
    status: "available",
    imageUrl: createSkillCardImageDataUri(
      "roadmap planner",
      "#14532D",
      "#16A34A",
    ),
  },
  {
    id: "knowledge-curator",
    name: "Knowledge Curator",
    description:
      "Maintains internal docs and updates key decision logs for discoverability.",
    assignedCount: 13,
    category: "Knowledge",
    status: "available",
    imageUrl: createSkillCardImageDataUri(
      "knowledge curator",
      "#1E293B",
      "#3B82F6",
    ),
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description:
      "Runs recurring security checks and provides prioritized remediation tickets.",
    assignedCount: 4,
    category: "Security",
    status: "available",
    imageUrl: createSkillCardImageDataUri(
      "security audit",
      "#111827",
      "#4B5563",
    ),
  },
  {
    id: "proposal-scorer",
    name: "Proposal Scorer",
    description:
      "Scores strategy proposals against expected impact, risk, and implementation effort.",
    assignedCount: 0,
    category: "Strategy",
    status: "coming-soon",
    imageUrl: createSkillCardImageDataUri(
      "proposal scorer",
      "#312E81",
      "#4F46E5",
    ),
  },
  {
    id: "hiring-planner",
    name: "Hiring Planner",
    description:
      "Maps hiring demand to roadmap outcomes and flags capacity bottlenecks early.",
    assignedCount: 0,
    category: "Talent",
    status: "coming-soon",
    imageUrl: createSkillCardImageDataUri(
      "hiring planner",
      "#0C4A6E",
      "#0284C7",
    ),
  },
  {
    id: "compliance-monitor",
    name: "Compliance Monitor",
    description:
      "Tracks compliance checkpoints, owner coverage, and unresolved policy gaps.",
    assignedCount: 0,
    category: "Governance",
    status: "coming-soon",
    imageUrl: createSkillCardImageDataUri(
      "compliance monitor",
      "#134E4A",
      "#0D9488",
    ),
  },
];

export const AVAILABLE_SKILLS = SKILL_REGISTRY.filter(
  (skill) => skill.status === "available",
);
export const COMING_SOON_SKILLS = SKILL_REGISTRY.filter(
  (skill) => skill.status === "coming-soon",
);

function createSkillCardImageDataUri(
  label: string,
  fromColor: string,
  toColor: string,
): string {
  const safeLabel = label.replace(/[^a-z0-9 ]/gi, "").trim() || "skill";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" role="img" aria-label="${safeLabel}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${fromColor}"/><stop offset="100%" stop-color="${toColor}"/></linearGradient></defs><rect width="720" height="360" fill="url(#bg)"/><circle cx="100" cy="70" r="120" fill="rgba(255,255,255,0.15)"/><circle cx="640" cy="300" r="170" fill="rgba(0,0,0,0.2)"/><text x="44" y="304" fill="rgba(255,255,255,0.94)" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="700">${safeLabel}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
