/**
 * Client-side memory candidate detection for chat messages.
 *
 * Scans assistant responses for structured factual statements about
 * the project, audience, brand, competitors, and preferences. Returns
 * a list of memory candidates the user can choose to save.
 */

import type { MemoryCategory, MemoryScope } from "@opengoat/contracts";

export interface MemoryCandidate {
  id: string;
  content: string;
  suggestedCategory: MemoryCategory;
  suggestedScope: MemoryScope;
  confidence: number;
}

interface PatternRule {
  patterns: RegExp[];
  category: MemoryCategory;
  scope: MemoryScope;
  confidence: number;
}

const RULES: PatternRule[] = [
  {
    category: "brand_voice",
    confidence: 0.75,
    patterns: [
      /\byour\s+brand\s+voice\b/i,
      /\bthe\s+tone\s+should\b/i,
      /\byour\s+voice\s+is\b/i,
      /\byour\s+brand\s+is\b/i,
      /\bbrand\s+tone\b/i,
    ],
    scope: "project",
  },
  {
    category: "product_facts",
    confidence: 0.8,
    patterns: [
      /\byour\s+product\s+is\b/i,
      /\byour\s+platform\s+is\b/i,
      /\bthe\s+app\s+does\b/i,
      /\byour\s+tool\s+is\b/i,
      /\byour\s+service\s+is\b/i,
      /\byour\s+product\s+does\b/i,
    ],
    scope: "project",
  },
  {
    category: "icp_facts",
    confidence: 0.8,
    patterns: [
      /\byour\s+target\s+audience\b/i,
      /\byour\s+ideal\s+customer\b/i,
      /\byour\s+users\s+are\b/i,
      /\byour\s+customers\s+are\b/i,
    ],
    scope: "project",
  },
  {
    category: "competitors",
    confidence: 0.7,
    patterns: [
      /\byour\s+(main\s+)?competitor\b/i,
      /\bcompared\s+to\s+\w+/i,
      /\balternative\s+to\s+\w+/i,
      /\bcompetes?\s+with\b/i,
    ],
    scope: "project",
  },
  {
    category: "channels_to_avoid",
    confidence: 0.75,
    patterns: [
      /\byou\s+should\s+avoid\b/i,
      /\bdon['']t\s+use\b/i,
      /\bstay\s+away\s+from\b/i,
      /\bavoid\s+using\b/i,
    ],
    scope: "project",
  },
  {
    category: "founder_preferences",
    confidence: 0.7,
    patterns: [
      /\byou\s+prefer\b/i,
      /\byour\s+preference\s+is\b/i,
      /\byou\s+like\s+to\b/i,
    ],
    scope: "project",
  },
];

const MAX_CANDIDATES = 3;

let candidateCounter = 0;

function generateId(): string {
  candidateCounter += 1;
  return `mem-${Date.now()}-${String(candidateCounter)}`;
}

function extractSentence(text: string, pattern: RegExp): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (pattern.test(sentence)) {
      return sentence;
    }
  }
  return text.trim();
}

/**
 * Detect memory candidates from an assistant response.
 *
 * Returns at most MAX_CANDIDATES candidates, each tagged with a
 * suggested memory category and scope.
 */
export function detectMemoryCandidates(assistantText: string): MemoryCandidate[] {
  if (!assistantText || assistantText.trim().length < 10) return [];

  const candidates: MemoryCandidate[] = [];
  const matchedCategories = new Set<string>();

  for (const rule of RULES) {
    if (candidates.length >= MAX_CANDIDATES) break;

    for (const pattern of rule.patterns) {
      if (candidates.length >= MAX_CANDIDATES) break;
      if (matchedCategories.has(rule.category)) break;

      if (pattern.test(assistantText)) {
        matchedCategories.add(rule.category);
        candidates.push({
          confidence: rule.confidence,
          content: extractSentence(assistantText, pattern),
          id: generateId(),
          suggestedCategory: rule.category,
          suggestedScope: rule.scope,
        });
        break; // Only one candidate per category
      }
    }
  }

  return candidates;
}
