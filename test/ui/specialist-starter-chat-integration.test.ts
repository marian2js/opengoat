import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chatSrc = readFileSync(
  resolve(
    import.meta.dirname,
    "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx",
  ),
  "utf-8",
);

describe("specialist-specific starter suggestions in ChatWorkspace", () => {
  it("imports getSpecialistMeta for specialist-specific suggestions", () => {
    expect(chatSrc).toContain("getSpecialistMeta");
  });

  it("uses currentSpecialistId to resolve starter prompts", () => {
    expect(chatSrc).toContain("currentSpecialistId");
    expect(chatSrc).toContain("starterPrompts");
  });

  it("has DEFAULT_STARTER_PROMPTS as fallback when no specialist is selected", () => {
    expect(chatSrc).toContain("DEFAULT_STARTER_PROMPTS");
  });

  it("does not use old hardcoded STARTER_PROMPTS constant", () => {
    expect(chatSrc).not.toMatch(/\bconst STARTER_PROMPTS\b/);
  });

  it("renders starterPrompts (resolved) not a static constant", () => {
    expect(chatSrc).toContain("starterPrompts.map");
  });

  it("clicking a suggestion sends it as the user message", () => {
    expect(chatSrc).toContain("handleSubmit({ text: prompt.text })");
  });
});
