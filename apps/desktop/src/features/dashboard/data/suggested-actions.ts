import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRightIcon,
  GlobeIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  SearchIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { ActionCard, ActionCategory } from "./actions";
import { starterActions } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * JSON-serializable subset of ActionCard (excludes `icon` — a React component).
 * This is what the AI returns and what gets persisted to SUGGESTED_ACTIONS.json.
 */
export interface SuggestedActionData {
  id: string;
  title: string;
  promise: string;
  description: string;
  category: ActionCategory;
  skills: string[];
  prompt: string;
  /** Short scannable deliverable label, e.g. "3 hero rewrites" */
  outputType?: string;
  /** Model-assigned tier: hero (1), primary (2-3), or secondary (1-2) */
  tier?: "hero" | "primary" | "secondary";
  /** Concrete output promise with quantities, e.g. "5 search wedges + page angles" */
  outputPromise?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUGGESTED_ACTIONS_FILENAME = "SUGGESTED_ACTIONS.json";

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<ActionCategory, LucideIcon> = {
  conversion: MousePointerClickIcon,
  distribution: GlobeIcon,
  growth: ArrowUpRightIcon,
  messaging: MessageSquareIcon,
  research: SearchIcon,
  seo: TrendingUpIcon,
};

const FALLBACK_ICON: LucideIcon = SparklesIcon;

// ---------------------------------------------------------------------------
// Category → Specialist mapping
// ---------------------------------------------------------------------------

export const CATEGORY_TO_SPECIALIST: Record<ActionCategory, string> = {
  conversion: "website-conversion",
  distribution: "distribution",
  seo: "seo-aeo",
  messaging: "positioning",
  research: "market-intel",
  growth: "content",
};

/** Maps a category string to a Lucide icon component. */
export function resolveIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category as ActionCategory] ?? FALLBACK_ICON;
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set<string>(["conversion", "distribution", "growth", "messaging", "research", "seo"]);
const VALID_TIERS = new Set<string>(["hero", "primary", "secondary"]);

function isValidSuggestedAction(item: unknown): item is SuggestedActionData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" && obj.id.length > 0 &&
    typeof obj.title === "string" && obj.title.length > 0 &&
    typeof obj.promise === "string" && obj.promise.length > 0 &&
    typeof obj.description === "string" && obj.description.length > 0 &&
    typeof obj.category === "string" && VALID_CATEGORIES.has(obj.category) &&
    (obj.skills === undefined || (Array.isArray(obj.skills) && obj.skills.every((s: unknown) => typeof s === "string"))) &&
    typeof obj.prompt === "string" && obj.prompt.length > 0 &&
    (obj.outputType === undefined || (typeof obj.outputType === "string" && obj.outputType.length > 0)) &&
    (obj.tier === undefined || (typeof obj.tier === "string" && VALID_TIERS.has(obj.tier))) &&
    (obj.outputPromise === undefined || (typeof obj.outputPromise === "string" && obj.outputPromise.length > 0))
  );
}

/**
 * Parses AI-generated JSON text into an array of SuggestedActionData.
 * Strips markdown code fences, handles malformed JSON gracefully.
 * Returns an empty array on any failure.
 */
export function parseSuggestedActions(raw: string): SuggestedActionData[] {
  if (!raw || typeof raw !== "string") return [];

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");
  cleaned = cleaned.trim();

  // Try to find JSON array in the text
  const startIndex = cleaned.indexOf("[");
  const endIndex = cleaned.lastIndexOf("]");
  if (startIndex !== -1 && endIndex > startIndex) {
    cleaned = cleaned.slice(startIndex, endIndex + 1);
  }

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSuggestedAction);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/** Converts a JSON-serializable SuggestedActionData to a full ActionCard. */
export function toActionCard(data: SuggestedActionData): ActionCard {
  return {
    ...data,
    skills: data.skills ?? [],
    icon: resolveIcon(data.category),
    specialistId: CATEGORY_TO_SPECIALIST[data.category],
    timeToFirstOutput: "30\u201390s",
    createsTrackedWork: false,
    outputType: data.outputType,
  };
}

// ---------------------------------------------------------------------------
// Generation prompt
// ---------------------------------------------------------------------------

const FIXED_CARD_TITLES = starterActions.map((a) => `- ${a.title}`).join("\n");

export const SUGGESTED_ACTIONS_PROMPT = `You are an expert startup marketing strategist. Your job is to suggest 4-6 high-leverage, company-specific marketing jobs for this particular business based on the workspace analysis.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this business deeply.

AVAILABLE SKILL CATALOG — reference these skill IDs in your suggestions:
- CRO: page-cro, signup-flow-cro, onboarding-cro, form-cro, popup-cro, paywall-upgrade-cro
- Content & Copy: copywriting, copy-editing, cold-email, email-sequence, social-content
- SEO & Discovery: seo-audit, ai-seo, schema-markup, site-architecture, programmatic-seo, content-strategy
- Paid & Distribution: paid-ads, ad-creative
- Measurement & Testing: analytics-tracking, ab-test-setup
- Retention: churn-prevention
- Growth Engineering: referral-program, free-tool-strategy
- Strategy: marketing-ideas, marketing-psychology, launch-strategy, pricing-strategy, lead-magnets
- Sales & GTM: revops, sales-enablement, competitor-alternatives
- Foundation: product-marketing-context

LEVERAGE-FIRST GENERATION CRITERIA — prioritize jobs that are:
- **Outside-in**: discover unknown opportunities about markets, search demand, competitors, channels, proof, or distribution — things the founder cannot see from inside the product
- **Revenue-adjacent**: tied to acquisition, conversion, trust, or demand generation — not internal cleanup or process work
- **Unknown-before-use**: reveal something the founder does not already know — the output should surprise, not just confirm
- **Hard-to-do-manually**: benefit significantly from company context + workflow packaging — not something achievable via a blank ChatGPT prompt

A strong first-run job should meet at least 3 of 4 criteria above.

DEMOTION RULES — avoid leading with these types of jobs:
- Packaging work the founder already understands (e.g., rewriting copy they wrote)
- Internal cleanup or "good hygiene" tasks (e.g., meta tag fixes, analytics setup)
- Generic rewrites achievable via blank chat (e.g., "rewrite homepage hero" without strategic edge)
- Incremental work that feels like maintenance rather than discovery
- Jobs whose output the founder could mostly predict before running them

These can appear as secondary jobs but should never dominate the top recommendations.

OUTPUT PROMISE RULES — each job must include a concrete outputPromise with:
- Specific quantities (e.g., "5", "20", "3-5")
- Tangible deliverable types (e.g., "search wedges + page angles", "communities + posting angles", "proof pages from product data")
- Never use abstract terms like "analysis", "strategy help", "growth recommendations", or "workflow result"

TIERING INSTRUCTIONS — self-rank each job:
- "hero" (exactly 1): the single highest-leverage, most novel job — the best first thing to do for this company. Must feel like discovery, not packaging.
- "primary" (2-3): strong follow-up jobs that are still high-value and varied across different marketing dimensions
- "secondary" (1-2): useful concrete jobs that are less essential as first-proof actions — packaging or optimization work lives here

IMPORTANT CONSTRAINTS:
- The following action cards ALREADY exist. Do NOT suggest duplicates or variations of these:
${FIXED_CARD_TITLES}
- Each suggestion must be DIFFERENT from the above — offer new angles based on what you learned about THIS specific business
- Titles must imply a concrete result (e.g., "Find 5 search wedges this product can own", "Map 20 communities where ideal users hang out")
- Do NOT use vague titles like "Improve marketing", "Build strategy", "Optimize funnel"
- Prompts must reference PRODUCT.md, MARKET.md, and GROWTH.md
- Categories must be one of: "conversion", "distribution", "growth", "messaging", "research", "seo"
- Skills must be an array of skill IDs from the catalog above — pick the 1-3 most relevant skills for each action

Return ONLY a JSON array with 4-6 objects. No other text, no markdown fences, no explanation.

Each object must have these exact fields:
{
  "id": "kebab-case-unique-id",
  "title": "Short actionable title (under 50 chars)",
  "promise": "One-line benefit statement (under 100 chars)",
  "description": "2-3 sentence description of what this action produces",
  "category": "conversion" | "distribution" | "growth" | "messaging" | "research" | "seo",
  "skills": ["skill-id-1", "skill-id-2"],
  "prompt": "Full detailed prompt that will be sent to the AI agent. Must reference PRODUCT.md, MARKET.md, and GROWTH.md workspace files. Must produce a concrete, useful output.",
  "outputType": "Short deliverable label (under 30 chars) — e.g. '3 hero rewrites', 'Launch copy bundle', 'SEO opportunity map'",
  "tier": "hero" | "primary" | "secondary",
  "outputPromise": "Concrete deliverable with quantities — e.g. '5 search wedges + page angles', '20 communities + posting angles', '5 proof pages from product data'"
}

EXAMPLES OF STRONG LEVERAGE-FIRST SUGGESTIONS (for a product analytics tool):
[
  {
    "id": "find-search-wedges",
    "title": "Find 5 search wedges you can own",
    "promise": "Discover high-intent search opportunities your competitors are missing",
    "description": "Analyzes search demand around product analytics pain points, identifies 5 specific keyword wedges where this product can realistically rank, and produces page angles for each wedge.",
    "category": "seo",
    "skills": ["seo-audit", "content-strategy"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Identify 5 specific search wedges this product can own. For each wedge, provide the target keyword cluster, estimated intent, current competitor coverage, and a concrete page angle this product should build.",
    "outputType": "SEO wedge map",
    "tier": "hero",
    "outputPromise": "5 search wedges + page angles with competitor gaps"
  },
  {
    "id": "build-proof-pages",
    "title": "Turn product data into 5 proof pages",
    "promise": "Convert your product's unique data into trust-building assets",
    "description": "Identifies 5 proof page opportunities from product data (benchmarks, case patterns, usage insights) and produces outlines that turn internal knowledge into external trust signals.",
    "category": "conversion",
    "skills": ["copywriting", "page-cro"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Identify 5 proof page opportunities where this product's data or usage patterns can be turned into trust-building content. For each, produce a page outline with headline, key data points, and conversion angle.",
    "outputType": "Proof page bundle",
    "tier": "primary",
    "outputPromise": "5 proof page outlines with data angles"
  },
  {
    "id": "map-competitor-comparison-angles",
    "title": "Generate 5 comparison pages you can win",
    "promise": "Find the competitor matchups where you have the strongest positioning",
    "description": "Analyzes the competitive landscape to find 5 specific comparison page opportunities where this product has clear advantages, and drafts positioning angles for each.",
    "category": "messaging",
    "skills": ["competitor-alternatives", "copywriting"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Identify 5 competitor comparison page opportunities. For each, explain why this product wins the matchup, draft the key positioning angles, and outline the page structure.",
    "outputType": "Comparison page backlog",
    "tier": "primary",
    "outputPromise": "5 comparison pages + positioning angles"
  },
  {
    "id": "find-launch-communities",
    "title": "Map 20 communities where ideal users gather",
    "promise": "Find the exact online spaces where your target users already hang out",
    "description": "Discovers 20 online communities (subreddits, Slack groups, Discord servers, forums, newsletters) where this product's ideal users actively discuss relevant problems, with posting angle suggestions.",
    "category": "distribution",
    "skills": ["marketing-ideas", "social-content"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Find 20 specific online communities where this product's ideal users gather. For each community, provide the name, URL, estimated relevance, and 2-3 posting angles tailored to that community's norms.",
    "outputType": "Community shortlist",
    "tier": "primary",
    "outputPromise": "20 communities + posting angles for each"
  },
  {
    "id": "create-outbound-angles",
    "title": "Draft 4 cold outbound angles + sequences",
    "promise": "Get ready-to-send outbound sequences targeting your best buyer signals",
    "description": "Identifies 4 distinct buyer signals for this product and drafts a cold outbound email sequence for each, personalized to the product's positioning and ICP.",
    "category": "growth",
    "skills": ["cold-email", "email-sequence"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Identify 4 buyer signals that indicate high purchase intent. For each signal, draft a 3-email cold outbound sequence with subject lines, hooks, and CTAs.",
    "outputType": "Outbound sequence pack",
    "tier": "secondary",
    "outputPromise": "4 outbound angles + 3-email sequences each"
  }
]

Now analyze the workspace files and suggest 4-6 actions tailored to THIS business.`;
