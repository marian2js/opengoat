import type { LucideIcon } from "lucide-react";
import {
  CalendarIcon,
  DollarSignIcon,
  FileTextIcon,
  GlobeIcon,
  LightbulbIcon,
  MailIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  RocketIcon,
  SearchIcon,
  ShieldCheckIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";

export type ActionCategory = "conversion" | "distribution" | "growth" | "messaging" | "research" | "seo";

export interface ActionCard {
  id: string;
  title: string;
  promise: string;
  description: string;
  icon: LucideIcon;
  category: ActionCategory;
  skills: string[];
  persona?: string;
  prompt: string;
}

export const categoryConfig: Record<
  ActionCategory,
  { label: string; className: string }
> = {
  conversion: {
    label: "Conversion",
    className:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  distribution: {
    label: "Distribution",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  growth: {
    label: "Growth",
    className:
      "border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-400",
  },
  messaging: {
    label: "Messaging",
    className:
      "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  research: {
    label: "Research",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  seo: {
    label: "SEO",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

export const starterActions: ActionCard[] = [
  // ── Distribution (4) ──────────────────────────────────────────────────
  {
    id: "find-launch-communities",
    title: "Find launch communities",
    promise:
      "Discover communities and launch surfaces ranked by fit for your product",
    description:
      "Identifies the most relevant online communities, forums, and launch platforms where your target audience gathers. Returns a ranked list with fit reasoning, posting norms, and suggested angles.",
    icon: UsersIcon,
    category: "distribution",
    skills: ["launch-strategy", "marketing-ideas"],
    persona: "growth-hacker",
    prompt: `Use the ORB framework (Owned/Rented/Borrowed channels) from launch-strategy and the 139 categorized tactics from marketing-ideas to identify and rank communities where this product should launch.

For each community: fit reasoning, posting norms, suggested angles, timing, and risk level.

End with a prioritized action plan for the top 3 communities.`,
  },
  {
    id: "draft-product-hunt-launch",
    title: "Draft Product Hunt launch",
    promise:
      "Generate taglines, descriptions, and first-comment angles for Product Hunt",
    description:
      "Creates ready-to-use Product Hunt launch assets including tagline options, description variants, first comment drafts, and maker story angles.",
    icon: RocketIcon,
    category: "distribution",
    skills: ["launch-strategy"],
    persona: "growth-hacker",
    prompt: `Use the Product Hunt section from launch-strategy — preparation, launch day, post-launch phases — and the case studies (SavvyCal, Reform) to create a complete launch package.

Produce:
1. 5 tagline variants (under 60 chars each)
2. 3 product descriptions (short, medium, detailed)
3. 2 first-comment drafts with authentic maker story angles
4. Gallery description suggestions
5. Launch day strategy with timing and engagement approach
6. Potential hunter questions with prepared answers
7. Category and topic tag recommendations`,
  },
  {
    id: "find-subreddits",
    title: "Find subreddits to launch",
    promise:
      "Find the best subreddits for your product with posting strategies",
    description:
      "Analyzes Reddit to find the most relevant subreddits, their rules, audience fit, and provides tailored posting strategies for each.",
    icon: GlobeIcon,
    category: "distribution",
    skills: ["marketing-ideas"],
    persona: "reddit-community-builder",
    prompt: `Use the community tactics from marketing-ideas to find and analyze the best subreddits for this product.

For each subreddit: name, subscriber estimate, activity level, relevance reasoning, rules and self-promotion policies, recommended post format, 2-3 specific post angles, best timing, and risk level.

Organize by priority tier (Tier 1: high fit, Tier 2: careful approach needed, Tier 3: monitor first).

End with a week-by-week Reddit engagement plan.`,
  },
  {
    id: "plan-social-content-calendar",
    title: "Plan social content calendar",
    promise:
      "Get a content calendar with platform-specific posts for your first 2 weeks",
    description:
      "Creates a 2-week social media content calendar with platform-specific post ideas, content pillars, hook variants, and posting schedules tailored to your product.",
    icon: CalendarIcon,
    category: "distribution",
    skills: ["social-content", "content-strategy"],
    persona: "social-media-strategist",
    prompt: `Use social-content's platform-specific tactics (LinkedIn, Twitter, Instagram, TikTok), hook formulas, content pillars, and repurposing systems. Combine with content-strategy's searchable vs shareable framework and topic clusters.

Produce a 2-week content calendar with:
- Specific post ideas per platform
- Content pillars and themes
- Hook variants for each post
- Recommended posting times
- Repurposing strategy across platforms`,
  },

  // ── Messaging (2) ─────────────────────────────────────────────────────
  {
    id: "rewrite-homepage-hero",
    title: "Rewrite homepage hero",
    promise:
      "Get hero copy rewrites tailored to your ICP and value proposition",
    description:
      "Analyzes your current homepage hero section and generates improved headline, subheadline, and CTA variants that better communicate your value proposition to your ideal customer.",
    icon: MessageSquareIcon,
    category: "messaging",
    skills: ["copywriting", "page-cro"],
    persona: "brand-guardian",
    prompt: `Use copywriting's headline formulas (outcome-focused, problem-focused, audience-focused, proof-focused) and CTA guidelines. Combine with page-cro's value proposition clarity assessment, CTA hierarchy, and visual hierarchy analysis.

Produce:
1. Current messaging assessment — what's working, what's not, and why
2. 5 headline rewrites (pain-point led, benefit-led, outcome-led, social proof led, curiosity/pattern interrupt)
3. 3 subheadline options per headline
4. 5 CTA text variants — action-oriented, specific
5. Supporting proof points to place near the hero
6. Recommended hero structure and visual hierarchy`,
  },
  {
    id: "draft-cold-email-sequence",
    title: "Draft cold email sequence",
    promise:
      "Get a multi-touch cold outreach sequence with subject lines and follow-ups",
    description:
      "Creates a complete cold email outreach sequence using proven copy frameworks, with subject lines, body copy, follow-up timing, and personalization strategies.",
    icon: MailIcon,
    category: "messaging",
    skills: ["cold-email", "email-sequence"],
    persona: "outbound-strategist",
    prompt: `Use cold-email's 11+ copy frameworks (PAS, BAB, QVC, AIDA, Star-Story-Solution, etc.), subject line patterns, personalization strategies, and follow-up sequences. Combine with email-sequence's timing and automation patterns.

Produce a 4-5 email sequence with:
- Subject lines for each email
- Body copy using the best-fit framework for each touch
- Follow-up timing recommendations
- Personalization tokens and signals
- Expected benchmarks (open rate, reply rate)`,
  },

  // ── Conversion (2) ────────────────────────────────────────────────────
  {
    id: "audit-landing-page-conversions",
    title: "Audit landing page conversions",
    promise:
      "Get a structured CRO analysis of your landing page with specific fixes",
    description:
      "Performs a systematic conversion rate optimization analysis across 7 dimensions with prioritized recommendations, copy alternatives, and test ideas.",
    icon: TargetIcon,
    category: "conversion",
    skills: ["page-cro"],
    persona: "ux-researcher",
    prompt: `Use page-cro's 7-dimension analysis framework: value proposition clarity, headline effectiveness, CTA placement, visual hierarchy, trust signals, objection handling, and friction points. Apply the page-type-specific frameworks (homepage, landing, pricing, feature, blog).

Produce:
- Quick wins (implementable today)
- High-impact changes with effort estimates
- A/B test ideas with hypotheses
- Copy alternatives for key sections
- All findings prioritized by expected impact`,
  },
  {
    id: "optimize-signup-flow",
    title: "Optimize signup flow",
    promise:
      "Find friction points in your signup process and get specific improvements",
    description:
      "Audits your signup and onboarding flow for friction, then provides field-by-field recommendations, social auth assessment, and post-signup activation improvements.",
    icon: MousePointerClickIcon,
    category: "conversion",
    skills: ["signup-flow-cro", "onboarding-cro"],
    persona: "ux-researcher",
    prompt: `Use signup-flow-cro's field optimization, social auth evaluation, trust signal placement, mobile-first checklist, and measurement framework. Combine with onboarding-cro's activation metrics, aha moment definition, empty state design, and multi-channel coordination.

Produce:
- Friction audit of current signup flow
- Field-by-field optimization recommendations
- Social auth assessment and recommendations
- Post-signup activation improvements
- Measurement plan with key metrics`,
  },

  // ── SEO (2) ───────────────────────────────────────────────────────────
  {
    id: "run-seo-audit",
    title: "Run SEO audit",
    promise:
      "Get a structured technical and on-page SEO audit with prioritized fixes",
    description:
      "Performs a comprehensive SEO audit covering crawlability, indexation, Core Web Vitals, on-page optimization, and content quality with prioritized action items.",
    icon: ShieldCheckIcon,
    category: "seo",
    skills: ["seo-audit", "schema-markup"],
    persona: "seo-specialist",
    prompt: `Use seo-audit's full framework: crawlability, indexation, Core Web Vitals, mobile, HTTPS, URL structure, on-page, content quality, and E-E-A-T assessment. Apply site-type-specific checks. Use schema-markup's structured data implementation guide.

Produce:
- Executive summary with overall health score
- Categorized findings with impact level, evidence, specific fix, and priority
- Structured data opportunities
- Prioritized action plan (quick wins, medium effort, strategic)`,
  },
  {
    id: "plan-content-strategy",
    title: "Plan content strategy",
    promise:
      "Get a content roadmap with topic clusters, keyword targets, and editorial calendar",
    description:
      "Creates a comprehensive content strategy with content pillars, topic clusters, keyword targets by buyer stage, and a prioritized editorial calendar.",
    icon: FileTextIcon,
    category: "seo",
    skills: ["content-strategy", "ai-seo"],
    persona: "seo-specialist",
    prompt: `Use content-strategy's searchable vs shareable framework, content pillars, topic clusters, keyword research by buyer stage, and prioritization scoring (customer impact 40%, content-market fit 30%, search potential 20%, resources 10%). Combine with ai-seo's optimization for AI search engines (ChatGPT, Perplexity, Claude).

Produce:
- 3-5 content pillars with rationale
- Priority topics with keyword targets and buyer stage mapping
- Topic cluster map showing hub-and-spoke relationships
- AI search optimization recommendations
- Recommended editorial calendar`,
  },

  // ── Research (2) ──────────────────────────────────────────────────────
  {
    id: "analyze-competitor-messaging",
    title: "Analyze competitor messaging",
    promise:
      "Map competitor positioning and find messaging gaps to exploit",
    description:
      "Performs a structured analysis of competitor positioning, messaging, and differentiation to identify gaps and opportunities for stronger positioning.",
    icon: SearchIcon,
    category: "research",
    skills: ["competitor-alternatives", "marketing-psychology"],
    persona: "brand-guardian",
    prompt: `Use competitor-alternatives' 4 comparison page formats (alternative, alternatives, vs, competitor-vs-competitor) and content architecture. Apply marketing-psychology's behavioral science frameworks and mental models.

Produce:
1. Competitor overview: positioning, target audience, messaging themes, strengths, weaknesses
2. Positioning map across key dimensions (simple/complex, technical/non-technical, enterprise/SMB)
3. Messaging gaps: unoccupied positions, underserved audiences, unclaimed value props
4. Counter-positioning recommendations per competitor
5. Comparison page opportunities`,
  },
  {
    id: "evaluate-pricing-strategy",
    title: "Evaluate pricing strategy",
    promise:
      "Get a pricing analysis with tier structure recommendations",
    description:
      "Analyzes your current pricing using value-based frameworks and provides tier structure recommendations, pricing psychology insights, and an implementation plan.",
    icon: DollarSignIcon,
    category: "research",
    skills: ["pricing-strategy"],
    prompt: `Use pricing-strategy's value-based pricing framework, value metrics, tier structures, research methods (Van Westendorp, MaxDiff), pricing psychology, and price increase strategy checklist.

Produce:
- Current pricing assessment against value-based benchmarks
- Value metric recommendations (what to charge for)
- Tier structure with feature allocation rationale
- Pricing psychology opportunities (anchoring, decoy, framing)
- Implementation plan with rollout strategy`,
  },

  // ── Growth (1) ────────────────────────────────────────────────────────
  {
    id: "generate-content-ideas",
    title: "Generate content ideas",
    promise:
      "Get prioritized content ideas tailored to your audience and channels",
    description:
      "Produces specific, ranked content ideas — blog topics, social post themes, and content angles — based on your ICP, positioning, and growth opportunities. Each idea includes a target channel, format suggestion, and impact reasoning.",
    icon: LightbulbIcon,
    category: "growth",
    skills: ["content-strategy", "marketing-ideas"],
    persona: "content-creator",
    prompt: `Use content-strategy's ideation sources (keyword data, call transcripts, forum research, competitor analysis) and prioritization framework. Combine with marketing-ideas' 139 categorized marketing tactics for creative angles.

Produce 8-12 specific content ideas, each with:
1. Working title (concrete, ready-to-use)
2. Target channel (blog, LinkedIn, X/Twitter, Reddit, newsletter, YouTube, etc.)
3. Format (long-form article, short post, thread, video script, infographic, case study)
4. Why it fits the ICP
5. Expected impact (high/medium/low with reasoning)

Rank by impact. Call out 2-3 "low-effort, high-impact" quick wins to start with this week.`,
  },
];
