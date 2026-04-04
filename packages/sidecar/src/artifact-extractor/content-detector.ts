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
 * Matches a heading string against a list of specialist outputTypes
 * using keyword token overlap. Returns the best match or null.
 *
 * Conservative: requires at least 50% of the outputType's tokens
 * to appear in the heading.
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

    // Require at least 50% token overlap
    if (score >= 0.5 && score > bestScore) {
      bestScore = score;
      bestMatch = outputType;
    }
  }

  return bestMatch;
}
