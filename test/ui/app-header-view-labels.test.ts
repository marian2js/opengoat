import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const headerSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/app/shell/AppHeader.tsx",
  ),
  "utf-8",
);

describe("AppHeader view labels", () => {
  // AC1: action-session view shows "Action Session" in the header
  it('includes "action-session" in the currentView type union', () => {
    expect(headerSrc).toMatch(/currentView.*"action-session"/);
  });

  it('maps action-session to "Action Session" page title', () => {
    expect(headerSrc).toContain('"Action Session"');
  });

  // AC2: objective view shows "Objective" in the header
  it('includes "objective" in the currentView type union', () => {
    expect(headerSrc).toMatch(/currentView.*"objective"/);
  });

  it('maps objective to "Objective" page title', () => {
    // Ensure the word "Objective" appears as a title string (not just in the type)
    expect(headerSrc).toMatch(/\?\s*"Objective"/);
  });

  // AC3: all other views retain their current labels
  it("still maps dashboard to Dashboard", () => {
    expect(headerSrc).toMatch(/currentView\s*===\s*"dashboard"\s*\n?\s*\?\s*"Dashboard"/);
  });

  it("still maps board to Board", () => {
    expect(headerSrc).toMatch(/currentView\s*===\s*"board"\s*\n?\s*\?\s*"Board"/);
  });

  it("still maps connections to Connections", () => {
    expect(headerSrc).toMatch(/currentView\s*===\s*"connections"\s*\n?\s*\?\s*"Connections"/);
  });

  it("still maps brain to Brain", () => {
    expect(headerSrc).toMatch(/currentView\s*===\s*"brain"\s*\n?\s*\?\s*"Brain"/);
  });

  it("still maps agents to Agents", () => {
    expect(headerSrc).toMatch(/currentView\s*===\s*"agents"\s*\n?\s*\?\s*"Agents"/);
  });

  it("still maps settings to Settings", () => {
    expect(headerSrc).toMatch(/currentView\s*===\s*"settings"\s*\n?\s*\?\s*"Settings"/);
  });

  it('falls back to "Chat" for the default case', () => {
    expect(headerSrc).toContain(': "Chat"');
  });
});
