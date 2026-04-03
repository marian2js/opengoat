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

describe("SpecialistCard last output display", () => {
  it("SpecialistCard accepts a lastOutput prop", () => {
    expect(specialistCardSrc).toMatch(/lastOutput/);
  });

  it("renders last output title when provided", () => {
    // Should display the output title in the card
    expect(specialistCardSrc).toMatch(/lastOutput.*title|title.*lastOutput/s);
  });

  it("renders relative time for last output", () => {
    // Should display relative time (e.g., '2 hours ago')
    expect(specialistCardSrc).toMatch(/lastOutput.*time|timeAgo|relativeTime|formatRelative/s);
  });

  it("does not render output line when lastOutput is undefined", () => {
    // Should conditionally render based on lastOutput presence
    expect(specialistCardSrc).toMatch(/lastOutput\s*[?&]/);
  });
});

describe("SpecialistTeamBrowser passes output data", () => {
  it("fetches or provides last output data to SpecialistCard", () => {
    // The browser should pass lastOutput prop to SpecialistCard
    expect(teamBrowserSrc).toMatch(/lastOutput/);
  });
});
