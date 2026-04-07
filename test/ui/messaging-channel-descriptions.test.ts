import { describe, expect, it } from "vitest";
import { MESSAGING_CHANNEL_DESCRIPTIONS } from "../../apps/desktop/src/features/connections/components/messaging-channel-descriptions";

describe("Messaging channel card descriptions", () => {
  it("telegram description communicates value, not setup process", () => {
    const desc = MESSAGING_CHANNEL_DESCRIPTIONS.telegram;
    expect(desc).toBeDefined();
    // Must not mention technical setup steps
    expect(desc).not.toMatch(/BotFather/i);
    expect(desc).not.toMatch(/create a bot/i);
    // Must communicate value/outcome
    expect(desc).toMatch(/marketing|advice|notification|job/i);
  });

  it("whatsapp description communicates value, not setup process", () => {
    const desc = MESSAGING_CHANNEL_DESCRIPTIONS.whatsapp;
    expect(desc).toBeDefined();
    // Must not mention technical setup steps
    expect(desc).not.toMatch(/QR code/i);
    expect(desc).not.toMatch(/link your/i);
    // Must communicate value/outcome
    expect(desc).toMatch(/question|output|marketing/i);
  });

  it("both descriptions avoid process language entirely", () => {
    for (const [, desc] of Object.entries(MESSAGING_CHANNEL_DESCRIPTIONS)) {
      expect(desc).not.toMatch(/create a bot/i);
      expect(desc).not.toMatch(/QR code/i);
      expect(desc).not.toMatch(/BotFather/i);
      expect(desc).not.toMatch(/link your/i);
    }
  });
});
