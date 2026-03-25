import { describe, expect, it } from "vitest";
import {
  getChannelPrompt,
  getTokenBudgetForChannel,
  type ChannelType,
} from "../../../packages/core/src/core/channel-prompts/channel-prompt.js";

describe("channel-prompt", () => {
  describe("getChannelPrompt", () => {
    it("returns a non-empty prompt for desktop channel", () => {
      const prompt = getChannelPrompt("desktop");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("returns a non-empty prompt for telegram channel", () => {
      const prompt = getChannelPrompt("telegram");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("returns a non-empty prompt for whatsapp channel", () => {
      const prompt = getChannelPrompt("whatsapp");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("desktop prompt mentions rich formatting / full length", () => {
      const prompt = getChannelPrompt("desktop");
      expect(prompt).toMatch(/full|rich|markdown|structured/i);
    });

    it("telegram prompt mentions concise / buttons", () => {
      const prompt = getChannelPrompt("telegram");
      expect(prompt).toMatch(/concise|short|brief/i);
      expect(prompt).toMatch(/button/i);
    });

    it("whatsapp prompt mentions short paragraphs / numbered options", () => {
      const prompt = getChannelPrompt("whatsapp");
      expect(prompt).toMatch(/short|brief|compact/i);
      expect(prompt).toMatch(/numbered/i);
    });

    it("telegram prompt includes escalation instructions", () => {
      const prompt = getChannelPrompt("telegram");
      expect(prompt).toMatch(/desktop/i);
    });

    it("whatsapp prompt includes escalation instructions", () => {
      const prompt = getChannelPrompt("whatsapp");
      expect(prompt).toMatch(/desktop/i);
    });

    it("wraps messaging prompts in channel-instructions tags", () => {
      const telegramPrompt = getChannelPrompt("telegram");
      expect(telegramPrompt).toContain("<channel-instructions>");
      expect(telegramPrompt).toContain("</channel-instructions>");

      const whatsappPrompt = getChannelPrompt("whatsapp");
      expect(whatsappPrompt).toContain("<channel-instructions>");
      expect(whatsappPrompt).toContain("</channel-instructions>");
    });

    it("wraps desktop prompt in channel-instructions tags", () => {
      const prompt = getChannelPrompt("desktop");
      expect(prompt).toContain("<channel-instructions>");
      expect(prompt).toContain("</channel-instructions>");
    });
  });

  describe("getTokenBudgetForChannel", () => {
    it("returns 2000 for desktop", () => {
      expect(getTokenBudgetForChannel("desktop")).toBe(2000);
    });

    it("returns 800 for telegram", () => {
      expect(getTokenBudgetForChannel("telegram")).toBe(800);
    });

    it("returns 800 for whatsapp", () => {
      expect(getTokenBudgetForChannel("whatsapp")).toBe(800);
    });

    it("returns 2000 for undefined (defaults to desktop)", () => {
      expect(getTokenBudgetForChannel(undefined)).toBe(2000);
    });
  });
});
