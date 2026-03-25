import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------- Unit tests for baseLabel utility ----------

// Import the actual utility
import { baseLabel } from "../../apps/desktop/src/lib/utils/base-label";

describe("baseLabel – strips dedup number suffixes", () => {
  it("strips a single-digit suffix", () => {
    expect(baseLabel("Launch on Product Hunt (2)")).toBe("Launch on Product Hunt");
  });

  it("strips a multi-digit suffix", () => {
    expect(baseLabel("Launch on Product Hunt (16)")).toBe("Launch on Product Hunt");
  });

  it("leaves labels without suffixes unchanged", () => {
    expect(baseLabel("Build outbound sequence")).toBe("Build outbound sequence");
  });

  it("leaves labels with parenthetical content that is not a number unchanged", () => {
    expect(baseLabel("SEO (advanced)")).toBe("SEO (advanced)");
  });

  it("handles empty string", () => {
    expect(baseLabel("")).toBe("");
  });

  it("strips suffix with extra whitespace", () => {
    expect(baseLabel("Launch on Product Hunt  (3)")).toBe("Launch on Product Hunt");
  });
});

// ---------- Source code structure tests ----------

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – action thread timestamps rendering fix", () => {
  // AC1: Duplicate detection uses baseLabel to strip dedup suffixes
  it("uses baseLabel to normalize labels before counting duplicates", () => {
    expect(sidebarSrc).toMatch(/baseLabel/);
    // Should use baseLabel when building labelCounts
    expect(sidebarSrc).toMatch(/baseLabel\(formatSessionLabel/);
  });

  // AC2: Duplicate check at render time also uses baseLabel
  it("checks duplicateLabels using baseLabel at render time", () => {
    expect(sidebarSrc).toMatch(/duplicateLabels\.has\(baseLabel\(/);
  });

  // AC3: Timestamp is not clipped by truncate class
  it("renders timestamp outside the truncated span or with shrink-0", () => {
    // The timestamp should either be outside the truncate span,
    // or use flex/shrink-0 to prevent clipping
    expect(sidebarSrc).toMatch(/shrink-0[\s\S]*?timestamp|timestamp[\s\S]*?shrink-0/);
  });

  // AC4: Threads with unique base names do not show timestamps
  it("only shows timestamp when duplicateLabels contains the base label", () => {
    expect(sidebarSrc).toMatch(/duplicateLabels\.has\(baseLabel\(label\)\)/);
  });
});
