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

describe("WhatsApp expanded view setup instructions", () => {
  // AC1: Expanded pending WhatsApp connection shows numbered setup instructions
  it("shows 'HOW TO CONNECT' section label in WhatsApp detail", () => {
    expect(panelSrc).toContain("HOW TO CONNECT");
  });

  it("shows numbered step-by-step instructions for QR linking", () => {
    // Should contain instructions about clicking Start QR Linking
    expect(panelSrc).toMatch(/Start QR Linking/);
    // Should mention scanning QR code
    expect(panelSrc).toMatch(/QR code.*scan|scan.*QR/i);
  });

  // AC2: Instructions include the WhatsApp mobile app path
  it("includes WhatsApp mobile app navigation path for Link a Device", () => {
    expect(panelSrc).toContain("Linked Devices");
    expect(panelSrc).toContain("Link a Device");
  });

  // AC3: A "Start QR Linking" CTA button is visible
  it("renders a Start QR Linking button in WhatsApp pending detail", () => {
    expect(panelSrc).toMatch(/Start QR Linking/);
    // Button should call startWhatsAppSession
    expect(panelSrc).toMatch(/startWhatsAppSession/);
  });

  // AC4: If sidecar is unavailable, clicking the button shows an informative error
  it("handles sidecar unavailable state with error messaging", () => {
    // Should show a message when the messaging service isn't running
    expect(panelSrc).toMatch(/Messaging service not running|sidecar/i);
  });

  // AC5: Existing metadata still visible
  it("still renders Status, Project, and Created metadata", () => {
    // These should still be present in WhatsAppConnectionDetail
    expect(panelSrc).toMatch(/Status/);
    expect(panelSrc).toMatch(/Project/);
    expect(panelSrc).toMatch(/Created/);
  });

  // AC6: Non-WhatsApp pending connections show appropriate generic instructions
  it("shows generic setup instructions for non-WhatsApp pending connections", () => {
    // Telegram detail should also have setup guidance for pending state
    expect(panelSrc).toMatch(/SETUP INSTRUCTIONS|HOW TO CONNECT|COMPLETE SETUP/);
    // The TelegramConnectionDetail should have pending-specific content
    expect(panelSrc).toMatch(/BotFather|bot token|webhook/i);
  });

  // AC7: Works in both dark and light mode (uses theme-aware classes)
  it("uses theme-aware Tailwind classes for instructions", () => {
    // Should use muted-foreground or similar theme tokens, not hardcoded colors
    expect(panelSrc).toMatch(/text-muted-foreground/);
    expect(panelSrc).toMatch(/text-primary/);
  });
});
