import { describe, expect, it } from "vitest";
import { formatForTelegram } from "../../../packages/core/src/core/telegram-channel/application/telegram-format-converter.js";

describe("formatForTelegram", () => {
  it("returns short text unchanged", () => {
    const input = "Here are your homepage rewrites!";
    expect(formatForTelegram(input)).toBe(input);
  });

  it("strips HTML tags", () => {
    const input = "Hello <b>world</b> and <a href='x'>link</a>";
    expect(formatForTelegram(input)).toBe("Hello world and link");
  });

  it("replaces Markdown tables with placeholder", () => {
    const input = `Here is a comparison:

| Feature | Us | Them |
| --- | --- | --- |
| Speed | Fast | Slow |
| Price | $10 | $20 |

Let me know what you think.`;
    const result = formatForTelegram(input);
    expect(result).toContain("(table — view in desktop app)");
    expect(result).not.toContain("| Feature |");
  });

  it("truncates long text with desktop redirect", () => {
    const longText = "A".repeat(5000);
    const result = formatForTelegram(longText);
    expect(result.length).toBeLessThanOrEqual(4000);
    expect(result).toContain("View the full version in OpenGoat desktop");
  });

  it("preserves normal Markdown formatting", () => {
    const input = "**Bold** and *italic* and `code`";
    expect(formatForTelegram(input)).toBe(input);
  });
});
