import type { LucideIcon } from "lucide-react";
import {
  GlobeIcon,
  LightbulbIcon,
  RocketIcon,
  MessageSquareIcon,
  SearchIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

export type ActionCategory = "distribution" | "messaging" | "research" | "seo";

export interface ActionCard {
  id: string;
  title: string;
  promise: string;
  description: string;
  icon: LucideIcon;
  category: ActionCategory;
  prompt: string;
}

export const categoryConfig: Record<
  ActionCategory,
  { label: string; className: string }
> = {
  distribution: {
    label: "Distribution",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
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
  {
    id: "find-launch-communities",
    title: "Find launch communities",
    promise:
      "Discover communities and launch surfaces ranked by fit for your product",
    description:
      "Identifies the most relevant online communities, forums, and launch platforms where your target audience gathers. Returns a ranked list with fit reasoning, posting norms, and suggested angles.",
    icon: UsersIcon,
    category: "distribution",
    prompt: `You are an expert at identifying launch communities and distribution channels for startups.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product, its target audience, market positioning, and growth opportunities.

Then produce a comprehensive, ranked list of online communities and launch surfaces where this product should be promoted. For each community:
- Name and URL
- Why it's a good fit (audience overlap, activity level, receptiveness)
- Community norms and posting guidelines
- Suggested content angles and hooks
- Risks and anti-patterns to avoid
- Recommended timing and approach

Rank by expected fit and impact. Include communities across Reddit, Hacker News, Product Hunt, niche forums, Discord servers, Slack communities, and any other relevant platforms.

End with a prioritized action plan: which 3 communities to target first and why.`,
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
    prompt: `You are an expert at Product Hunt launches for startups.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product deeply.

Create a complete Product Hunt launch preparation package:

1. **Tagline options** (5 variants, each under 60 chars) — punchy, benefit-focused, no jargon
2. **Product description** (3 variants) — short, medium, and detailed versions
3. **First comment draft** (2 variants) — authentic maker story that builds connection
4. **Gallery description suggestions** — what screenshots/visuals to include
5. **Recommended launch day strategy** — timing, engagement approach, follow-up plan
6. **Potential questions from hunters** and prepared answers
7. **Category and topic tag recommendations**

Make everything specific to this product. No generic templates.`,
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
    prompt: `You are an expert at Reddit marketing for startups.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product and its audience.

Find and analyze the best subreddits for this product:

For each subreddit:
- Name, subscriber count estimate, and activity level
- Why it's relevant (audience overlap with our ICP)
- Subreddit rules and self-promotion policies
- Recommended post format (text, link, image)
- 2-3 specific post angle ideas tailored to that community's culture
- Best time to post
- Risk level (strict vs lenient moderation)

Organize by priority tier:
- **Tier 1**: High fit, active, receptive to products like this
- **Tier 2**: Good fit, requires more careful approach
- **Tier 3**: Worth monitoring or engaging in comments first

End with a Reddit launch playbook: week-by-week engagement plan.`,
  },
  {
    id: "rewrite-homepage-hero",
    title: "Rewrite homepage hero",
    promise:
      "Get hero copy rewrites tailored to your ICP and value proposition",
    description:
      "Analyzes your current homepage hero section and generates improved headline, subheadline, and CTA variants that better communicate your value proposition to your ideal customer.",
    icon: MessageSquareIcon,
    category: "messaging",
    prompt: `You are an expert startup copywriter specializing in homepage messaging.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product's value proposition, target audience, and competitive positioning.

Analyze the current homepage messaging and produce:

1. **Current messaging assessment** — what's working, what's not, and why
2. **Headline rewrites** (5 options) — each taking a different angle:
   - Pain-point led
   - Benefit-led
   - Outcome-led
   - Social proof / authority led
   - Curiosity / pattern interrupt
3. **Subheadline options** (3 per headline) — expanding on the promise
4. **CTA text variants** (5 options) — action-oriented, specific
5. **Supporting proof points** — what evidence to place near the hero
6. **Recommended hero structure** — visual hierarchy and content order

For each option, explain why it would resonate with the target ICP. Be specific to this product — no generic marketing advice.`,
  },
  {
    id: "analyze-competitor-messaging",
    title: "Analyze competitor messaging",
    promise:
      "Map competitor positioning and find messaging gaps to exploit",
    description:
      "Performs a structured analysis of competitor positioning, messaging, and differentiation to identify gaps and opportunities for stronger positioning.",
    icon: SearchIcon,
    category: "research",
    prompt: `You are an expert competitive analyst specializing in startup positioning.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product's market and competitive landscape.

Conduct a thorough competitor messaging analysis:

1. **Competitor overview** — for each identified competitor:
   - Their core positioning statement
   - Primary target audience
   - Key messaging themes
   - Strengths in their messaging
   - Weaknesses or gaps in their messaging
   - Pricing positioning (premium, mid-market, budget)

2. **Positioning map** — where each competitor sits on key dimensions:
   - Simple vs Complex
   - Technical vs Non-technical audience
   - Feature-rich vs Focused
   - Enterprise vs SMB/Startup

3. **Messaging gaps** — unoccupied positions worth claiming:
   - Underserved audiences
   - Unaddressed pain points
   - Unclaimed value propositions
   - Differentiation opportunities

4. **Counter-positioning recommendations** — how to position against each competitor specifically

5. **Recommended positioning statement** — a clear, defensible position based on the gaps found`,
  },
  {
    id: "find-seo-quick-wins",
    title: "Find SEO quick wins",
    promise:
      "Identify the highest-impact SEO improvements on your existing pages",
    description:
      "Reviews your site for the most impactful, quick-to-implement SEO improvements including meta tags, content structure, keyword opportunities, and technical issues.",
    icon: TrendingUpIcon,
    category: "seo",
    prompt: `You are an expert SEO consultant for startups.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product, its market, and growth opportunities.

Analyze the website and identify the highest-impact SEO quick wins:

1. **Technical SEO issues** (if identifiable):
   - Meta title and description problems
   - Heading structure (H1, H2, H3) issues
   - Missing alt text on images
   - Page speed concerns
   - Mobile responsiveness issues
   - Schema markup opportunities

2. **Content quick wins**:
   - Pages that could rank with minor improvements
   - Missing content that competitors have
   - Internal linking opportunities
   - Content gaps based on likely search intent

3. **Keyword opportunities**:
   - Low-competition keywords relevant to this product
   - Long-tail variations worth targeting
   - Question-based keywords for FAQ/content
   - Comparison keywords (vs competitor)

4. **Recommended priority actions** — ranked by effort vs impact:
   - Quick wins (< 1 hour each)
   - Medium wins (1-4 hours each)
   - Strategic wins (worth planning for)

Be specific to this product's market and audience. No generic SEO checklists.`,
  },
  {
    id: "generate-content-ideas",
    title: "Generate content ideas",
    promise:
      "Get blog, social, and content marketing ideas tailored to your audience",
    description:
      "Produces specific, ranked content ideas — blog topics, social post themes, and content angles — based on your ICP, positioning, and growth opportunities. Each idea includes a target channel, format suggestion, and impact reasoning.",
    icon: LightbulbIcon,
    category: "messaging",
    prompt: `You are an expert content strategist for startups.

Read the workspace context files — PRODUCT.md, MARKET.md, and GROWTH.md — to understand this product's value proposition, target audience, competitive landscape, and growth opportunities.

Produce a prioritized list of 8–12 specific content ideas tailored to this product. For each idea:

1. **Working title** — a concrete, ready-to-use title (not a vague topic)
2. **Target channel** — where to publish (blog, LinkedIn, X/Twitter, Reddit, newsletter, YouTube, etc.)
3. **Format** — long-form article, short post, thread, video script, infographic, or case study
4. **Why it fits the ICP** — how this idea resonates with the target audience's pain points and interests
5. **Expected impact** — high / medium / low, with brief reasoning

Rank the ideas by expected impact (highest first).

After the full list, call out 2–3 "low-effort, high-impact" quick wins the team can start with this week.

Be specific to this product. No generic content marketing advice. Every idea should reference something concrete about the product, its market, or its audience.`,
  },
];
