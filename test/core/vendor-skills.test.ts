import { describe, expect, it } from "vitest";
import {
  parseFrontmatter,
  serializeFrontmatter,
} from "../../packages/core/src/core/skills/scripts/frontmatter.js";
import { normalizeMarketing } from "../../packages/core/src/core/skills/scripts/normalize-marketing.js";
import {
  extractDescription,
  normalizePersona,
} from "../../packages/core/src/core/skills/scripts/normalize-personas.js";
import { wrapSkill } from "../../packages/core/src/core/skills/scripts/wrap.js";
import { mapContext } from "../../packages/core/src/core/skills/scripts/map-context.js";
import { generateCredits } from "../../packages/core/src/core/skills/scripts/credits.js";

describe("frontmatter", () => {
  describe("parseFrontmatter", () => {
    it("parses simple key-value frontmatter", () => {
      const input = [
        "---",
        "name: seo-audit",
        "description: Run an SEO audit",
        "---",
        "",
        "# SEO Audit",
        "",
        "Body content here.",
      ].join("\n");

      const result = parseFrontmatter(input);
      expect(result.frontmatter).toEqual({
        name: "seo-audit",
        description: "Run an SEO audit",
      });
      expect(result.body).toContain("# SEO Audit");
      expect(result.body).toContain("Body content here.");
    });

    it("joins multiline values to single line", () => {
      const input = [
        "---",
        "description: This is a long",
        "  description that spans",
        "  multiple lines",
        "name: test",
        "---",
        "",
        "Body",
      ].join("\n");

      const result = parseFrontmatter(input);
      expect(result.frontmatter["description"]).toBe(
        "This is a long description that spans multiple lines",
      );
      expect(result.frontmatter["name"]).toBe("test");
    });

    it("returns empty frontmatter if no --- markers", () => {
      const input = "# Just a heading\n\nSome content.";
      const result = parseFrontmatter(input);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(input);
    });

    it("returns empty frontmatter if closing --- is missing", () => {
      const input = "---\nname: test\n# Content";
      const result = parseFrontmatter(input);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(input);
    });

    it("handles metadata as single-line JSON", () => {
      const input = [
        "---",
        'metadata: {"version":"1.0","tags":["seo","audit"]}',
        "name: test",
        "---",
        "",
        "Body",
      ].join("\n");

      const result = parseFrontmatter(input);
      expect(result.frontmatter["metadata"]).toBe(
        '{"version":"1.0","tags":["seo","audit"]}',
      );
    });
  });

  describe("serializeFrontmatter", () => {
    it("roundtrips through parse/serialize", () => {
      const input = [
        "---",
        "name: test-skill",
        "description: A test skill",
        "---",
        "",
        "# Test",
        "",
        "Content.",
      ].join("\n");

      const parsed = parseFrontmatter(input);
      const output = serializeFrontmatter(parsed);
      expect(output).toBe(input);
    });

    it("returns body only when no frontmatter keys", () => {
      const result = serializeFrontmatter({
        frontmatter: {},
        body: "# Content",
      });
      expect(result).toBe("# Content");
    });
  });
});

describe("normalizeMarketing", () => {
  it("preserves valid single-line frontmatter", () => {
    const input = [
      "---",
      "name: seo-audit",
      "description: Audit SEO",
      "---",
      "",
      "# SEO Audit body",
    ].join("\n");

    const result = normalizeMarketing(input);
    expect(result).toContain("name: seo-audit");
    expect(result).toContain("description: Audit SEO");
    expect(result).toContain("# SEO Audit body");
  });

  it("joins multiline frontmatter values to single lines", () => {
    const input = [
      "---",
      "description: A very long",
      "  multi-line description",
      "name: test",
      "---",
      "",
      "Body",
    ].join("\n");

    const result = normalizeMarketing(input);
    expect(result).toContain(
      "description: A very long multi-line description",
    );
  });

  it("normalizes metadata JSON to single line", () => {
    const input = [
      "---",
      "name: test",
      'metadata: {"version" : "1.0" ,  "tags": ["a", "b"]}',
      "---",
      "",
      "Body",
    ].join("\n");

    const result = normalizeMarketing(input);
    expect(result).toContain('metadata: {"version":"1.0","tags":["a","b"]}');
  });
});

describe("normalizePersona", () => {
  it("rewrites name to slug and drops unsupported keys", () => {
    const input = [
      "---",
      "name: SEO Specialist",
      "tools: web_search, web_fetch",
      "color: #FF0000",
      "emoji: 🔍",
      "vibe: analytical",
      "---",
      "",
      "You are an SEO specialist focused on organic growth.",
      "",
      "## Capabilities",
    ].join("\n");

    const result = normalizePersona(input, "seo-specialist");

    // Should have slug name
    expect(result).toContain("name: seo-specialist");
    // Should NOT have unsupported keys
    expect(result).not.toContain("tools:");
    expect(result).not.toContain("color:");
    expect(result).not.toContain("emoji:");
    expect(result).not.toContain("vibe:");
    // Body should be preserved
    expect(result).toContain(
      "You are an SEO specialist focused on organic growth.",
    );
    expect(result).toContain("## Capabilities");
  });

  it("adds description from body if not in frontmatter", () => {
    const input = [
      "---",
      "name: Old Name",
      "---",
      "",
      "You are a growth hacker who drives viral adoption.",
      "",
      "## More content",
    ].join("\n");

    const result = normalizePersona(input, "growth-hacker");
    expect(result).toContain("description: You are a growth hacker who drives viral adoption.");
  });

  it("preserves existing description if present", () => {
    const input = [
      "---",
      "name: Old Name",
      "description: Existing description",
      "---",
      "",
      "Body content here.",
    ].join("\n");

    const result = normalizePersona(input, "test-persona");
    expect(result).toContain("description: Existing description");
  });
});

describe("extractDescription", () => {
  it("extracts first non-heading line", () => {
    const body = "\n# Title\n\nYou are a specialist.\n\n## Section";
    expect(extractDescription(body)).toBe("You are a specialist.");
  });

  it("truncates long lines", () => {
    const longLine = "A".repeat(130);
    const body = `\n${longLine}\n`;
    const desc = extractDescription(body);
    expect(desc.length).toBeLessThanOrEqual(120);
    expect(desc).toContain("...");
  });

  it("returns default if body is empty", () => {
    expect(extractDescription("")).toBe("Specialized agent persona");
    expect(extractDescription("\n\n")).toBe("Specialized agent persona");
  });
});

describe("wrapSkill", () => {
  it("adds disable-model-invocation: true to frontmatter", () => {
    const input = [
      "---",
      "name: test-skill",
      "description: A test",
      "---",
      "",
      "# Content",
    ].join("\n");

    const result = wrapSkill(input);
    expect(result).toContain("disable-model-invocation: true");
    expect(result).toContain("name: test-skill");
    expect(result).toContain("# Content");
  });

  it("overwrites existing disable-model-invocation value", () => {
    const input = [
      "---",
      "name: test",
      "disable-model-invocation: false",
      "---",
      "",
      "Body",
    ].join("\n");

    const result = wrapSkill(input);
    expect(result).toContain("disable-model-invocation: true");
    // Should not have both true and false
    expect(result).not.toContain("disable-model-invocation: false");
  });
});

describe("mapContext", () => {
  it("replaces .agents/product-marketing-context.md preamble", () => {
    const input = [
      "# Initial Assessment",
      "",
      "If `.agents/product-marketing-context.md` exists (or `.claude/product-marketing-context.md`",
      "in older setups), read it before asking questions.",
      "",
      "## Next Section",
    ].join("\n");

    const result = mapContext(input);
    expect(result).toContain("PRODUCT.md, MARKET.md, and GROWTH.md");
    expect(result).not.toContain(".agents/product-marketing-context.md");
    expect(result).toContain("## Next Section");
  });

  it("replaces inline backtick references", () => {
    const input =
      "Check `.agents/product-marketing-context.md` for product info.";
    const result = mapContext(input);
    expect(result).toContain("PRODUCT.md, MARKET.md, and GROWTH.md");
    expect(result).not.toContain(".agents/product-marketing-context.md");
  });

  it("replaces .claude variant inline references", () => {
    const input =
      "Read `.claude/product-marketing-context.md` for context.";
    const result = mapContext(input);
    expect(result).toContain("PRODUCT.md, MARKET.md, and GROWTH.md");
  });

  it("leaves content without context references untouched", () => {
    const input = "# SEO Audit\n\nCheck the robots.txt file.";
    const result = mapContext(input);
    expect(result).toBe(input);
  });
});

describe("generateCredits", () => {
  it("generates correct attribution text", () => {
    const result = generateCredits({
      repoName: "marketingskills",
      repoUrl: "https://github.com/coreyhaines31/marketingskills",
      commitSha: "abc123",
      license: "MIT",
    });

    expect(result).toContain("marketingskills");
    expect(result).toContain("https://github.com/coreyhaines31/marketingskills");
    expect(result).toContain("abc123");
    expect(result).toContain("MIT");
  });
});
