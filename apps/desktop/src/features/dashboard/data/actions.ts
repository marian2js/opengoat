import type { LucideIcon } from "lucide-react";
import {
  FileTextIcon,
  GlobeIcon,
  LightbulbIcon,
  MailIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  RocketIcon,
  SearchIcon,
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
  timeToFirstOutput: string;
  createsTrackedWork: boolean;
}

export const categoryConfig: Record<
  ActionCategory,
  { label: string; className: string; accentColor: string }
> = {
  conversion: {
    label: "Conversion",
    className:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    accentColor: "bg-rose-500",
  },
  distribution: {
    label: "Distribution",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    accentColor: "bg-blue-500",
  },
  growth: {
    label: "Growth",
    className:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    accentColor: "bg-cyan-500",
  },
  messaging: {
    label: "Messaging",
    className:
      "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
    accentColor: "bg-purple-500",
  },
  research: {
    label: "Research",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    accentColor: "bg-amber-500",
  },
  seo: {
    label: "SEO",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    accentColor: "bg-emerald-500",
  },
};

export const starterActions: ActionCard[] = [
  {
    id: "launch-product-hunt",
    title: "Launch on Product Hunt",
    promise: "Tagline, one-liner, launch post draft, checklist, and outreach angles",
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
    timeToFirstOutput: "30–60s",
    createsTrackedWork: true,
  },
  {
    id: "rewrite-homepage-hero",
    title: "Rewrite homepage hero",
    promise: "3 hero variants, CTA options, and trust copy ideas",
    description:
      "Analyzes your current homepage hero section and generates improved headline, subheadline, and CTA variants that better communicate your value proposition.",
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
    timeToFirstOutput: "30–90s",
    createsTrackedWork: false,
  },
  {
    id: "improve-homepage-conversion",
    title: "Improve homepage conversion",
    promise: "Top blockers, rewrite suggestions, CTA fixes, and proof recommendations",
    description:
      "Performs a systematic conversion rate optimization analysis across 7 dimensions with prioritized recommendations, copy alternatives, and test ideas.",
    icon: MousePointerClickIcon,
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
    timeToFirstOutput: "45–90s",
    createsTrackedWork: true,
  },
  {
    id: "build-outbound-sequence",
    title: "Build outbound sequence",
    promise: "Audience angle, email sequence, subject lines, and follow-up ideas",
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
    timeToFirstOutput: "30–60s",
    createsTrackedWork: true,
  },
  {
    id: "find-seo-quick-wins",
    title: "Find SEO quick wins",
    promise: "Prioritized opportunities, quick fixes, and 5 content targets",
    description:
      "Performs a focused SEO audit to surface the highest-impact quick wins: technical fixes, on-page improvements, and content opportunities you can act on this week.",
    icon: GlobeIcon,
    category: "seo",
    skills: ["seo-audit", "content-strategy"],
    persona: "seo-specialist",
    prompt: `Use seo-audit's framework to surface only quick wins — changes that can be implemented this week with high expected impact. Focus on: crawlability issues, missing meta tags, thin content, internal linking gaps, and low-hanging keyword opportunities. Combine with content-strategy's prioritization scoring.

Produce:
- 5 highest-impact quick fixes with specific instructions
- 5 content targets (keywords + topic + suggested format)
- Technical issues sorted by severity
- Estimated effort and impact for each recommendation`,
    timeToFirstOutput: "45–90s",
    createsTrackedWork: true,
  },
  {
    id: "create-comparison-page-outline",
    title: "Create comparison page outline",
    promise: "Competitor differences, page structure, and messaging gaps",
    description:
      "Performs a structured analysis of competitor positioning and creates an outline for a comparison page that highlights your differentiation.",
    icon: SearchIcon,
    category: "research",
    skills: ["competitor-alternatives", "marketing-psychology"],
    persona: "brand-guardian",
    prompt: `Use competitor-alternatives' 4 comparison page formats (alternative, alternatives, vs, competitor-vs-competitor) and content architecture. Apply marketing-psychology's behavioral science frameworks and mental models.

Produce:
1. Competitor overview: positioning, target audience, messaging themes, strengths, weaknesses
2. Positioning map across key dimensions
3. Messaging gaps: unoccupied positions, underserved audiences, unclaimed value props
4. Recommended comparison page structure with sections
5. Key differentiators to highlight
6. SEO angle for comparison keywords`,
    timeToFirstOutput: "45–90s",
    createsTrackedWork: true,
  },
  {
    id: "generate-founder-content-ideas",
    title: "Generate founder content ideas",
    promise: "Topics, hooks, post outlines, and repurposing ideas",
    description:
      "Produces specific, ranked content ideas for founder-led marketing — LinkedIn posts, Twitter threads, blog topics, and newsletter angles tailored to your positioning.",
    icon: LightbulbIcon,
    category: "growth",
    skills: ["content-strategy", "marketing-ideas"],
    persona: "content-creator",
    prompt: `Use content-strategy's ideation sources (keyword data, call transcripts, forum research, competitor analysis) and prioritization framework. Combine with marketing-ideas' 139 categorized marketing tactics for creative angles.

Produce 8-12 specific content ideas, each with:
1. Working title (concrete, ready-to-use)
2. Target channel (LinkedIn, X/Twitter, blog, newsletter)
3. Format (post, thread, article, video script)
4. Hook (the opening line or angle)
5. Why it fits the ICP
6. Expected impact (high/medium/low with reasoning)

Rank by impact. Call out 2-3 "low-effort, high-impact" quick wins.`,
    timeToFirstOutput: "30–60s",
    createsTrackedWork: false,
  },
  {
    id: "create-lead-magnet-ideas",
    title: "Create lead magnet ideas",
    promise: "3 lead magnet concepts, ICP fit, and landing page angle",
    description:
      "Generates lead magnet concepts tailored to your ICP, with positioning rationale, content outlines, and landing page copy angles for each concept.",
    icon: FileTextIcon,
    category: "growth",
    skills: ["content-strategy", "page-cro"],
    persona: "growth-hacker",
    prompt: `Use content-strategy's audience-first ideation and page-cro's conversion principles to design lead magnets that attract and qualify your ideal customers.

Produce:
1. 3 lead magnet concepts, each with:
   - Title and format (checklist, template, guide, tool, quiz)
   - Why it fits the ICP specifically
   - Content outline (key sections/steps)
   - Landing page headline + CTA angle
   - Distribution strategy (where to promote)
2. Comparison matrix: effort vs expected conversion
3. Recommended first-build priority with rationale`,
    timeToFirstOutput: "30–60s",
    createsTrackedWork: false,
  },
];
