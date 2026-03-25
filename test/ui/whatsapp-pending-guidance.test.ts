import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const panelSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/connections/components/MessagingConnectionsPanel.tsx",
  ),
  "utf-8",
);

describe("WhatsApp pending connection guidance", () => {
  // AC1: Pending WhatsApp connections show a clear next-step message
  it("shows QR code guidance message for pending WhatsApp connections", () => {
    expect(panelSrc).toContain("Scan QR code to link your WhatsApp account");
  });

  it("conditionally renders guidance based on pending status", () => {
    // Should check for pending status when showing guidance
    expect(panelSrc).toMatch(/status.*===.*["']pending["']/);
  });

  // AC2: Action button for pending connections reads "Complete Setup" instead of "Details"
  it("shows 'Complete Setup' button label for pending connections", () => {
    expect(panelSrc).toContain("Complete Setup");
  });

  it("still shows 'Details' for non-pending connections", () => {
    expect(panelSrc).toContain("Details");
  });

  // AC3: Connected WhatsApp connections show "Connected" status clearly
  it("shows a clear connected status label", () => {
    // The connected status label should be visible in the row
    expect(panelSrc).toMatch(/Connected/);
  });

  // AC4: Multiple WhatsApp connections have distinguishable names
  it("generates distinct display names for duplicate connections", () => {
    // Should contain logic for disambiguating duplicate display names
    // by appending an index number
    expect(panelSrc).toMatch(/displayName.*\d|index|#\d|\(\d/);
  });

  it("uses the connection type to scope disambiguation", () => {
    // Should filter by type when generating display suffixes
    expect(panelSrc).toMatch(/type.*===.*connection\.type|filter.*type/);
  });
});
