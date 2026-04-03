/**
 * Client-side handoff suggestion detection for chat messages.
 *
 * Scans assistant responses for specialist name mentions combined with
 * handoff-intent phrases. Returns suggestions the user can click to
 * navigate to the recommended specialist's chat with context.
 */

export interface HandoffSuggestion {
  id: string;
  specialistId: string;
  specialistName: string;
  reason: string;
}

/**
 * Mapping of specialist display names to their registry IDs.
 * Order matters — longer/more specific names must come first
 * to avoid partial matches (e.g., "SEO/AEO" before "SEO").
 */
const SPECIALIST_NAME_MAP: { name: string; id: string; pattern: RegExp }[] = [
  { name: "Market Intel", id: "market-intel", pattern: /\bmarket\s+intel(?:\s+agent)?\b/i },
  { name: "Website Conversion", id: "website-conversion", pattern: /\bwebsite\s+conversion(?:\s+agent)?\b/i },
  { name: "SEO/AEO", id: "seo-aeo", pattern: /\bseo\/aeo(?:\s+agent)?\b/i },
  { name: "SEO", id: "seo-aeo", pattern: /\bseo(?:\s+agent)\b/i },
  { name: "Distribution", id: "distribution", pattern: /\bdistribution(?:\s+agent)?\b/i },
  { name: "Positioning", id: "positioning", pattern: /\bpositioning(?:\s+agent)?\b/i },
  { name: "Content", id: "content", pattern: /\bcontent(?:\s+agent)\b/i },
  { name: "Outbound", id: "outbound", pattern: /\boutbound(?:\s+agent)?\b/i },
  { name: "CMO", id: "cmo", pattern: /\bcmo(?:\s+agent)?\b/i },
];

/**
 * Intent phrases that indicate the assistant is suggesting a handoff.
 * Must appear near a specialist name mention for a positive detection.
 */
const HANDOFF_INTENT_PATTERNS = [
  /\bcould\s+help\b/i,
  /\bcan\s+help\b/i,
  /\bwould\s+be\s+great\b/i,
  /\bspecializes?\s+in\b/i,
  /\bsuggest\b/i,
  /\brecommend\b/i,
  /\bhand\s+(?:this\s+)?off\s+to\b/i,
  /\btalk(?:ing)?\s+to\b/i,
  /\bcould\s+(?:also\s+)?(?:sharpen|refine|improve|deepen|produce|craft|build|create|draft|plan|analyze|review|optimize)\b/i,
  /\bwould\s+(?:also\s+)?(?:sharpen|refine|improve|deepen|produce|craft|build|create|draft|plan|analyze|review|optimize)\b/i,
];

const MAX_SUGGESTIONS = 2;

let suggestionCounter = 0;

function generateId(): string {
  suggestionCounter += 1;
  return `handoff-${Date.now()}-${String(suggestionCounter)}`;
}

function extractSentence(text: string, matchIndex: number): string {
  // Find sentence boundaries around the match position
  const beforeText = text.slice(0, matchIndex);
  const afterText = text.slice(matchIndex);

  // Find sentence start (look backwards for . ! ? or start of text)
  const sentenceStartMatch = beforeText.match(/(?:.*[.!?\n]\s*)([^.!?\n]*)$/);
  const sentenceStart = sentenceStartMatch
    ? matchIndex - sentenceStartMatch[1].length
    : 0;

  // Find sentence end (look forwards for . ! ? or end of text)
  const sentenceEndMatch = afterText.match(/^[^.!?\n]*[.!?\n]?/);
  const sentenceEnd = sentenceEndMatch
    ? matchIndex + sentenceEndMatch[0].length
    : text.length;

  return text.slice(sentenceStart, sentenceEnd).trim();
}

function hasHandoffIntent(sentence: string): boolean {
  return HANDOFF_INTENT_PATTERNS.some((pattern) => pattern.test(sentence));
}

/**
 * Detect handoff suggestions from an assistant response.
 *
 * Scans for specialist name mentions paired with handoff-intent phrases.
 * Filters out self-references and CMO suggestions.
 * Returns at most MAX_SUGGESTIONS results.
 */
export function detectHandoffSuggestions(
  assistantText: string,
  currentSpecialistId?: string,
): HandoffSuggestion[] {
  if (!assistantText || assistantText.trim().length < 10) return [];

  const suggestions: HandoffSuggestion[] = [];
  const matchedSpecialistIds = new Set<string>();

  for (const spec of SPECIALIST_NAME_MAP) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (matchedSpecialistIds.has(spec.id)) continue;

    // Skip CMO — handoffs go specialist-to-specialist or CMO-to-specialist
    if (spec.id === "cmo") continue;

    // Skip self-references
    if (currentSpecialistId && spec.id === currentSpecialistId) continue;

    const match = spec.pattern.exec(assistantText);
    if (!match) continue;

    // Extract the sentence containing the mention
    const sentence = extractSentence(assistantText, match.index);

    // Check for handoff intent in the sentence
    if (!hasHandoffIntent(sentence)) continue;

    matchedSpecialistIds.add(spec.id);
    suggestions.push({
      id: generateId(),
      specialistId: spec.id,
      specialistName: spec.name,
      reason: sentence,
    });
  }

  return suggestions;
}
