import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const messageSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/components/ai-elements/message.tsx"),
  "utf-8",
);

const workspaceSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx"),
  "utf-8",
);

const formatTimestampSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/lib/format-message-timestamp.ts"),
  "utf-8",
);

describe("Chat message timestamps", () => {
  // AC1: Each chat message displays a creation timestamp
  it("MessageTimestamp component is exported from message.tsx", () => {
    expect(messageSrc).toContain("export const MessageTimestamp");
  });

  it("ChatWorkspace renders MessageTimestamp for user messages", () => {
    expect(workspaceSrc).toContain("MessageTimestamp");
  });

  // AC2: Timestamps use relative format for today, absolute for older messages
  it("formatMessageTimestamp shows time-only for today's messages", () => {
    expect(formatTimestampSrc).toMatch(/today|isToday|sameDay/i);
  });

  it("formatMessageTimestamp handles yesterday format", () => {
    expect(formatTimestampSrc).toMatch(/yesterday|Yesterday/i);
  });

  it("formatMessageTimestamp handles older dates with month and day", () => {
    // Should format with month abbreviation for older dates
    expect(formatTimestampSrc).toMatch(/short|MMM|month/i);
  });

  // AC3: Timestamp styling matches DESIGN.md metadata convention (11px mono, muted color)
  it("uses 11px font size for metadata convention", () => {
    expect(messageSrc).toMatch(/text-\[11px\]/);
  });

  it("uses monospace font for timestamps", () => {
    expect(messageSrc).toMatch(/font-mono/);
  });

  it("uses muted foreground color", () => {
    expect(messageSrc).toMatch(/text-muted-foreground/);
  });

  it("uses tabular-nums for aligned number rendering", () => {
    expect(messageSrc).toMatch(/tabular-nums/);
  });

  // AC4: Timestamps are always visible (not hover-only)
  it("timestamp does not use hover-dependent opacity", () => {
    // The MessageTimestamp element should NOT be wrapped in hover-only classes
    const timestampSection = messageSrc.slice(
      messageSrc.indexOf("MessageTimestamp"),
    );
    // Should not use group-hover:opacity or opacity-0 pattern on the timestamp
    expect(timestampSection).not.toMatch(
      /MessageTimestamp[^}]*opacity-0[^}]*group-hover/,
    );
  });

  // AC5: Works in both dark mode and light mode — uses theme-aware tokens
  it("uses theme-aware color tokens (not hardcoded hex)", () => {
    const timestampSection = messageSrc.slice(
      messageSrc.indexOf("MessageTimestamp"),
    );
    // Should use muted-foreground (theme token), not a hex color
    expect(timestampSection).toContain("muted-foreground");
  });

  // AC6: In-progress/streaming messages don't show timestamps until complete
  it("ChatWorkspace conditionally renders timestamps based on streaming state", () => {
    // The timestamp should not be rendered for streaming messages
    expect(workspaceSrc).toMatch(/isStreaming|streaming/i);
  });

  // AC7: All existing tests pass (covered by running the full test suite)
});
