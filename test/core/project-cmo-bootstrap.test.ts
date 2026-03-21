import { describe, expect, it } from "vitest";
import { listProjectCmoBootstrapPrompts } from "../../packages/core/src/core/projects/application/project-cmo-bootstrap.js";

describe("project CMO bootstrap prompts", () => {
  const sampleUrl = "https://example.com";
  const prompts = listProjectCmoBootstrapPrompts(sampleUrl);

  const productPrompt = prompts.find((p) => p.id === "product")!;
  const marketPrompt = prompts.find((p) => p.id === "market")!;
  const growthPrompt = prompts.find((p) => p.id === "growth")!;

  it("replaces the URL placeholder in all prompts", () => {
    for (const prompt of prompts) {
      expect(prompt.message).toContain(sampleUrl);
      expect(prompt.message).not.toContain("{{URL}}");
    }
  });

  it("product prompt includes Brand voice signals section", () => {
    expect(productPrompt.message).toContain("Brand voice signals");
    expect(productPrompt.message).toContain("tone");
    expect(productPrompt.message).toContain("Communication style");
    expect(productPrompt.message).toContain("Brand personality");
  });

  it("market prompt includes Switching dynamics section", () => {
    expect(marketPrompt.message).toContain("Switching dynamics");
    expect(marketPrompt.message).toContain("Push");
    expect(marketPrompt.message).toContain("Pull");
    expect(marketPrompt.message).toContain("Habit");
    expect(marketPrompt.message).toContain("Anxiety");
  });

  it("market prompt includes Customer language section", () => {
    expect(marketPrompt.message).toContain("Customer language");
    expect(marketPrompt.message).toContain("How customers describe the problem");
    expect(marketPrompt.message).toContain("How customers describe the solution");
    expect(marketPrompt.message).toContain("Terms to use");
    expect(marketPrompt.message).toContain("Terms to avoid");
  });

  it("growth prompt does NOT contain the new sections", () => {
    expect(growthPrompt.message).not.toContain("Brand voice signals");
    expect(growthPrompt.message).not.toContain("Switching dynamics");
    expect(growthPrompt.message).not.toContain("Customer language");
  });

  it("existing product prompt sections are preserved", () => {
    expect(productPrompt.message).toContain("Company summary");
    expect(productPrompt.message).toContain("Product offerings");
    expect(productPrompt.message).toContain("Positioning signals");
    expect(productPrompt.message).toContain("Open questions");
  });

  it("existing market prompt sections are preserved", () => {
    expect(marketPrompt.message).toContain("ICP hypotheses");
    expect(marketPrompt.message).toContain("Competitor landscape");
    expect(marketPrompt.message).toContain("Market opportunities");
    expect(marketPrompt.message).toContain("Open questions");
  });
});
