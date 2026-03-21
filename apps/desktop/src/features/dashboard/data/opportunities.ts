import {
  extractSection,
  firstParagraphOrBullet,
} from "../lib/parse-workspace-summary";

export type OpportunityCategory =
  | "messaging"
  | "positioning"
  | "distribution"
  | "seo";

export interface Opportunity {
  id: string;
  title: string;
  explanation: string;
  category: OpportunityCategory;
  relatedActionId?: string;
}

export const opportunityCategoryConfig: Record<
  OpportunityCategory,
  { label: string; className: string }
> = {
  messaging: {
    label: "Messaging",
    className:
      "border-purple-500/30 text-purple-700 dark:text-purple-400",
  },
  positioning: {
    label: "Positioning",
    className:
      "border-amber-500/30 text-amber-700 dark:text-amber-400",
  },
  distribution: {
    label: "Distribution",
    className:
      "border-blue-500/30 text-blue-700 dark:text-blue-400",
  },
  seo: {
    label: "SEO",
    className:
      "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  },
};

interface OpportunityTemplate {
  id: string;
  title: string;
  file: "product" | "market" | "growth";
  headings: string[];
  category: OpportunityCategory;
  relatedActionId?: string;
}

const templates: OpportunityTemplate[] = [
  {
    id: "messaging-weakness",
    title: "Messaging weaknesses identified",
    file: "product",
    headings: ["Weaknesses in current messaging", "Open questions"],
    category: "messaging",
    relatedActionId: "rewrite-homepage-hero",
  },
  {
    id: "differentiation-gap",
    title: "Differentiation opportunities exist",
    file: "market",
    headings: ["Differentiation hypotheses", "Competitor hypotheses"],
    category: "positioning",
    relatedActionId: "analyze-competitor-messaging",
  },
  {
    id: "community-opportunity",
    title: "Niche communities worth exploring",
    file: "market",
    headings: [
      "Likely communities and channels",
      "Communities and channels",
    ],
    category: "distribution",
    relatedActionId: "find-launch-communities",
  },
  {
    id: "conversion-issues",
    title: "Website conversion issues found",
    file: "growth",
    headings: ["Website conversion issues", "Messaging risks"],
    category: "seo",
    relatedActionId: "find-seo-quick-wins",
  },
  {
    id: "content-opportunity",
    title: "Content opportunities available",
    file: "growth",
    headings: ["Content opportunities", "Content pillars"],
    category: "distribution",
    relatedActionId: "generate-content-ideas",
  },
  {
    id: "channel-possibilities",
    title: "Channel-specific possibilities identified",
    file: "growth",
    headings: ["Channel-specific possibilities", "Channel priorities"],
    category: "distribution",
    relatedActionId: "find-launch-communities",
  },
  {
    id: "growth-experiments",
    title: "Growth experiments worth testing",
    file: "growth",
    headings: ["Experiment ideas", "Tactical growth ideas"],
    category: "distribution",
    relatedActionId: "find-launch-communities",
  },
];

export interface WorkspaceFiles {
  productMd: string | null;
  marketMd: string | null;
  growthMd: string | null;
}

function getFileContent(
  files: WorkspaceFiles,
  file: OpportunityTemplate["file"],
): string | null {
  switch (file) {
    case "product":
      return files.productMd;
    case "market":
      return files.marketMd;
    case "growth":
      return files.growthMd;
  }
}

/**
 * Evaluates opportunity templates against workspace file content.
 * Returns matched opportunities where the referenced section has content.
 */
export function extractOpportunities(files: WorkspaceFiles): Opportunity[] {
  const results: Opportunity[] = [];

  for (const template of templates) {
    const content = getFileContent(files, template.file);
    if (!content) continue;

    let sectionContent: string | null = null;
    for (const heading of template.headings) {
      sectionContent = extractSection(content, heading);
      if (sectionContent) break;
    }
    if (!sectionContent) continue;

    const explanation = firstParagraphOrBullet(sectionContent);
    if (!explanation) continue;

    const opp: Opportunity = {
      id: template.id,
      title: template.title,
      explanation,
      category: template.category,
    };
    if (template.relatedActionId) {
      opp.relatedActionId = template.relatedActionId;
    }
    results.push(opp);
  }

  return results;
}
