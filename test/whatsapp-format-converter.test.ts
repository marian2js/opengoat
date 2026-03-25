import { describe, expect, it } from "vitest";
import {
  chunkMessage,
  formatForWhatsApp,
  createMediaPlaceholder,
} from "../packages/core/src/core/whatsapp-channel/application/whatsapp-format-converter.js";

describe("WhatsApp Format Converter", () => {
  describe("chunkMessage", () => {
    it("returns single chunk for short messages", () => {
      const result = chunkMessage("Hello, how can I help?");
      expect(result).toEqual(["Hello, how can I help?"]);
    });

    it("chunks long message at paragraph boundaries", () => {
      const para1 = "A".repeat(1500);
      const para2 = "B".repeat(1500);
      const text = `${para1}\n\n${para2}`;
      const result = chunkMessage(text, 2000);
      expect(result.length).toBe(2);
      expect(result[0]).toContain("(1/2)");
      expect(result[1]).toContain("(2/2)");
      expect(result[0]).toContain(para1);
      expect(result[1]).toContain(para2);
    });

    it("adds numbered markers for multi-chunk messages", () => {
      const text = "A".repeat(5000);
      const result = chunkMessage(text, 2000);
      expect(result.length).toBeGreaterThan(1);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toContain(`(${i + 1}/${result.length})`);
      }
    });

    it("handles message with no paragraph breaks by falling back to sentence split", () => {
      const sentences = Array.from(
        { length: 20 },
        (_, i) => `This is sentence number ${i + 1} which has some content.`,
      );
      const text = sentences.join(" ");
      const result = chunkMessage(text, 200);
      expect(result.length).toBeGreaterThan(1);
      // Each chunk should be within limits (plus marker overhead)
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(220); // small overhead for marker
      }
    });

    it("handles empty string", () => {
      const result = chunkMessage("");
      expect(result).toEqual([""]);
    });

    it("truncates to summary for very long outputs exceeding 3 chunks", () => {
      const text = "A".repeat(10000);
      const result = chunkMessage(text, 2000);
      // Should cap at a reasonable number of chunks
      expect(result.length).toBeLessThanOrEqual(4);
      // Last chunk should suggest viewing full output in desktop
      if (result.length > 3) {
        expect(result[result.length - 1]).toContain("OpenGoat");
      }
    });
  });

  describe("formatForWhatsApp", () => {
    it("strips unsupported Markdown (headers, links)", () => {
      const text = "# Heading\n\nSome text with [a link](http://example.com) and **bold**.";
      const result = formatForWhatsApp(text);
      expect(result).not.toContain("# ");
      expect(result).not.toContain("[a link]");
      expect(result).toContain("bold");
      expect(result).toContain("a link");
    });

    it("keeps bold and italic formatting", () => {
      const text = "This is *italic* and **bold** text.";
      const result = formatForWhatsApp(text);
      expect(result).toContain("*italic*");
      expect(result).toContain("*bold*");
    });

    it("passes through plain text unchanged", () => {
      const text = "Just some plain text.";
      expect(formatForWhatsApp(text)).toBe("Just some plain text.");
    });
  });

  describe("createMediaPlaceholder", () => {
    it("returns placeholder text for media messages", () => {
      const result = createMediaPlaceholder("image");
      expect(result).toContain("media message");
      expect(result).toContain("WhatsApp");
    });

    it("includes the media type", () => {
      const result = createMediaPlaceholder("video");
      expect(result.toLowerCase()).toContain("video");
    });
  });
});
