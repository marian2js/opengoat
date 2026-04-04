export interface DetectedSection {
  heading: string;
  content: string;
  startIndex: number;
}

const MIN_CONTENT_LENGTH = 50;

/**
 * Splits markdown text into sections delimited by `## ` headings.
 * Filters out sections whose body content is below the minimum threshold.
 */
export function detectSections(markdownText: string): DetectedSection[] {
  const lines = markdownText.split("\n");
  const sections: DetectedSection[] = [];

  let currentHeading: string | null = null;
  let currentContent: string[] = [];
  let currentStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      // Flush previous section
      if (currentHeading !== null) {
        const body = currentContent.join("\n").trim();
        if (body.length >= MIN_CONTENT_LENGTH) {
          sections.push({
            heading: currentHeading,
            content: body,
            startIndex: currentStartIndex,
          });
        }
      }
      currentHeading = line.slice(3).trim();
      currentContent = [];
      currentStartIndex = i;
    } else if (currentHeading !== null) {
      currentContent.push(line);
    }
  }

  // Flush last section
  if (currentHeading !== null) {
    const body = currentContent.join("\n").trim();
    if (body.length >= MIN_CONTENT_LENGTH) {
      sections.push({
        heading: currentHeading,
        content: body,
        startIndex: currentStartIndex,
      });
    }
  }

  return sections;
}

/**
 * Tokenize a string into lowercase alphanumeric words.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Check if two tokens share a common stem (first N characters).
 * Requires both tokens to be at least 4 chars and share a prefix of at least 6 chars.
 */
function sharesStem(a: string, b: string): boolean {
  const stemLen = Math.min(a.length, b.length, 7);
  return stemLen >= 6 && a.slice(0, stemLen) === b.slice(0, stemLen);
}

/**
 * Matches a heading string against a list of specialist outputTypes
 * using keyword token overlap with keyword-based fallback.
 *
 * Primary: requires at least 30% of the outputType's tokens to appear in the heading.
 * Fallback: if no match via token overlap, checks if any heading token shares
 * a stem with a significant outputType keyword (length >= 4).
 */
export function matchHeadingToOutputType(
  heading: string,
  outputTypes: string[],
): string | null {
  const headingTokens = new Set(tokenize(heading));
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const outputType of outputTypes) {
    const outputTokens = tokenize(outputType);
    if (outputTokens.length === 0) continue;

    const overlap = outputTokens.filter((t) => headingTokens.has(t)).length;
    const score = overlap / outputTokens.length;

    // Require at least 30% token overlap
    if (score >= 0.3 && score > bestScore) {
      bestScore = score;
      bestMatch = outputType;
    }
  }

  if (bestMatch) return bestMatch;

  // Keyword-based fallback: match via stem overlap with outputType keywords
  for (const outputType of outputTypes) {
    const keywords = tokenize(outputType).filter((t) => t.length >= 4);
    for (const keyword of keywords) {
      for (const ht of headingTokens) {
        if (ht.length >= 4 && sharesStem(ht, keyword)) {
          return outputType;
        }
      }
    }
  }

  return null;
}
