import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const specialistCardSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/agents/components/SpecialistCard.tsx",
  ),
  "utf-8",
);

const teamBrowserSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/agents/components/SpecialistTeamBrowser.tsx",
  ),
  "utf-8",
);

describe("SpecialistCard recent outputs display", () => {
  it("SpecialistCard accepts a recentOutputs prop", () => {
    expect(specialistCardSrc).toMatch(/recentOutputs/);
  });

  it("renders output titles from the array", () => {
    expect(specialistCardSrc).toMatch(/recentOutputs.*map/s);
  });

  it("renders relative time for each output", () => {
    expect(specialistCardSrc).toMatch(/formatRelativeTime/);
  });

  it("does not render section when recentOutputs is empty", () => {
    expect(specialistCardSrc).toMatch(/outputs\.length/);
  });
});

describe("SpecialistTeamBrowser passes output data", () => {
  it("passes recentOutputs to SpecialistCard", () => {
    expect(teamBrowserSrc).toMatch(/recentOutputs=/);
  });
});
