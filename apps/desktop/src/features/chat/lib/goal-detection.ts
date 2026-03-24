/**
 * Client-side goal detection heuristic for chat messages.
 *
 * Scans user messages for intent phrases combined with outcome phrases
 * to detect when a user is expressing a goal that could become an objective.
 */

export interface GoalDetectionResult {
  detected: boolean;
  goalPhrase: string;
  confidence: number;
}

const INTENT_PATTERNS = [
  /\bi\s+want\s+to\b/i,
  /\bi\s+need\s+to\b/i,
  /\bi['']m\s+trying\s+to\b/i,
  /\bhelp\s+me\b/i,
  /\bwe\s+need\s+to\b/i,
  /\bour\s+goal\s+is\s+to\b/i,
  /\bi['']d\s+like\s+to\b/i,
  /\bwe\s+want\s+to\b/i,
  /\bwe\s+should\b/i,
  /\blet['']s\b/i,
];

const OUTCOME_PATTERNS = [
  /\b(increase|boost|double|triple)\b/i,
  /\b(launch|ship|release|deploy)\b/i,
  /\b(improve|optimize|enhance|upgrade)\b/i,
  /\b(grow|expand|scale)\b/i,
  /\b(build|create|develop|design|make)\b/i,
  /\b(start|begin|kick\s*off|initiate)\b/i,
  /\b(reduce|decrease|cut|lower|minimize)\b/i,
  /\b(automate|streamline|simplify)\b/i,
  /\b(migrate|convert|transform|rebrand)\b/i,
];

// Phrases that indicate informational questions, not goal-oriented intent
const EXCLUDE_PATTERNS = [
  /\bwhat\s+(does|is|are|do)\b/i,
  /\bcan\s+you\s+explain\b/i,
  /\bhow\s+does\b/i,
  /\bwhat\s+about\b/i,
  /\btell\s+me\s+about\b/i,
  /\bwhat\s+are\s+the\s+best\b/i,
  /\bknow\s+more\s+about\b/i,
];

const NOT_DETECTED: GoalDetectionResult = {
  confidence: 0,
  detected: false,
  goalPhrase: "",
};

function extractGoalSentence(text: string, intentMatch: RegExp): string {
  // Split into sentences and find the one with the intent match
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const sentence of sentences) {
    if (intentMatch.test(sentence)) {
      return sentence;
    }
  }
  return text.trim();
}

/**
 * Detect goal-oriented intent from user messages.
 *
 * Requires at least one intent phrase AND one outcome phrase in the same
 * user message for a positive detection. Scans messages newest-first so
 * the most recent matching message determines the goal phrase.
 */
export function detectGoalIntent(
  userMessages: string[],
  _assistantText: string,
): GoalDetectionResult {
  if (userMessages.length === 0) return NOT_DETECTED;

  // Iterate newest-first
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const text = userMessages[i];
    if (!text || text.trim().length < 10) continue;

    // Check exclusions first
    if (EXCLUDE_PATTERNS.some((p) => p.test(text))) continue;

    // Find an intent match
    const intentMatch = INTENT_PATTERNS.find((p) => p.test(text));
    if (!intentMatch) continue;

    // Find an outcome match
    const outcomeMatch = OUTCOME_PATTERNS.find((p) => p.test(text));
    if (!outcomeMatch) continue;

    const goalPhrase = extractGoalSentence(text, intentMatch);
    return {
      confidence: 0.8,
      detected: true,
      goalPhrase,
    };
  }

  return NOT_DETECTED;
}
