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

/** Maps a category string to a Lucide icon component. */
export function resolveIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category as ActionCategory] ?? FALLBACK_ICON;
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set<string>(["conversion", "distribution", "growth", "messaging", "research", "seo"]);

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
    typeof obj.prompt === "string" && obj.prompt.length > 0
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
  };
}

// ---------------------------------------------------------------------------
// Generation prompt
// ---------------------------------------------------------------------------

const FIXED_CARD_TITLES = starterActions.map((a) => `- ${a.title}`).join("\n");

export const SUGGESTED_ACTIONS_PROMPT = `You are an expert startup marketing strategist. Your job is to suggest 2-3 highly specific, actionable marketing tasks for this particular business based on the workspace analysis.

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

Analyze the workspace context, consider which skills would be most impactful for this business, and suggest 2-3 action cards. Each card should represent a concrete marketing task that produces a specific deliverable.

IMPORTANT CONSTRAINTS:
- The following action cards ALREADY exist. Do NOT suggest duplicates or variations of these:
${FIXED_CARD_TITLES}
- Each suggestion must be DIFFERENT from the above — offer new angles based on what you learned about THIS specific business
- Titles must imply a concrete result (e.g., "Draft comparison page vs [Competitor]", "Write launch post for r/[specific subreddit]")
- Do NOT use vague titles like "Improve marketing", "Build strategy", "Optimize funnel"
- Prompts must reference PRODUCT.md, MARKET.md, and GROWTH.md
- Categories must be one of: "conversion", "distribution", "growth", "messaging", "research", "seo"
- Skills must be an array of skill IDs from the catalog above — pick the 1-3 most relevant skills for each action
- Each suggestion must produce a concrete deliverable

Return ONLY a JSON array with 2-3 objects. No other text, no markdown fences, no explanation.

Each object must have these exact fields:
{
  "id": "kebab-case-unique-id",
  "title": "Short actionable title (under 50 chars)",
  "promise": "One-line benefit statement (under 100 chars)",
  "description": "2-3 sentence description of what this action produces",
  "category": "conversion" | "distribution" | "growth" | "messaging" | "research" | "seo",
  "skills": ["skill-id-1", "skill-id-2"],
  "prompt": "Full detailed prompt that will be sent to the AI agent. Must reference PRODUCT.md, MARKET.md, and GROWTH.md workspace files. Must produce a concrete, useful output."
}

EXAMPLES OF GOOD SUGGESTIONS (for a product analytics tool):
[
  {
    "id": "build-referral-program",
    "title": "Design a referral program",
    "promise": "Get a complete referral program with incentives, mechanics, and tracking",
    "description": "Designs a referral program tailored to this product using viral loop mechanics, incentive structures, and tracking setup.",
    "category": "growth",
    "skills": ["referral-program"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Design a complete referral program with incentive structure, viral mechanics, referral flow, tracking setup, and launch plan."
  },
  {
    "id": "draft-comparison-vs-mixpanel",
    "title": "Draft comparison page vs Mixpanel",
    "promise": "Create a detailed comparison page highlighting your advantages over Mixpanel",
    "description": "Analyzes Mixpanel's positioning and creates a comparison page draft that highlights your unique advantages, addresses common switching objections, and targets users searching for alternatives.",
    "category": "messaging",
    "skills": ["competitor-alternatives", "copywriting"],
    "prompt": "Read PRODUCT.md, MARKET.md, and GROWTH.md. Then create a detailed comparison page draft of our product vs Mixpanel..."
  }
]

Now analyze the workspace files and suggest 2-3 actions tailored to THIS business.`;
