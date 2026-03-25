import { describe, expect, it } from "vitest";
import { resolveModelDisplayLabel } from "../../apps/desktop/src/features/connections/components/model-display-helpers";

describe("resolveModelDisplayLabel", () => {
  it("returns the selected model label from catalog", () => {
    const catalog = {
      providerId: "github-copilot",
      currentModelRef: "github-copilot/gpt-5-mini",
      currentModelId: "gpt-5-mini",
      models: [
        { modelRef: "github-copilot/claude-haiku-4-5", modelId: "claude-haiku-4-5", label: "Claude Haiku 4.5", providerId: "github-copilot", isSelected: false },
        { modelRef: "github-copilot/gpt-5-mini", modelId: "gpt-5-mini", label: "GPT-5 mini", providerId: "github-copilot", isSelected: true },
      ],
    };
    expect(resolveModelDisplayLabel(catalog, undefined)).toBe("GPT-5 mini");
  });

  it("returns the label matching currentModelRef when no model is isSelected", () => {
    const catalog = {
      providerId: "github-copilot",
      currentModelRef: "github-copilot/gpt-5-mini",
      currentModelId: "gpt-5-mini",
      models: [
        { modelRef: "github-copilot/claude-haiku-4-5", modelId: "claude-haiku-4-5", label: "Claude Haiku 4.5", providerId: "github-copilot", isSelected: false },
        { modelRef: "github-copilot/gpt-5-mini", modelId: "gpt-5-mini", label: "GPT-5 mini", providerId: "github-copilot", isSelected: false },
      ],
    };
    expect(resolveModelDisplayLabel(catalog, undefined)).toBe("GPT-5 mini");
  });

  it("falls back to activeModelId when catalog is unavailable", () => {
    expect(resolveModelDisplayLabel(undefined, "gpt-5-mini")).toBe("gpt-5-mini");
  });

  it("returns fallback text when no model info is available", () => {
    expect(resolveModelDisplayLabel(undefined, undefined)).toBe("\u2014");
  });

  it("falls back to first model label when currentModelRef is missing", () => {
    const catalog = {
      providerId: "github-copilot",
      models: [
        { modelRef: "github-copilot/claude-haiku-4-5", modelId: "claude-haiku-4-5", label: "Claude Haiku 4.5", providerId: "github-copilot", isSelected: false },
      ],
    };
    expect(resolveModelDisplayLabel(catalog, undefined)).toBe("Claude Haiku 4.5");
  });

  it("falls back to activeModelId when catalog has empty models", () => {
    const catalog = {
      providerId: "github-copilot",
      models: [],
    };
    expect(resolveModelDisplayLabel(catalog, "gpt-5-mini")).toBe("gpt-5-mini");
  });
});
