import { describe, expect, it } from "vitest";
import {
  formatUiLogTimestamp,
  logsConnectionStateBadgeClassName,
  uiLogLevelClassName,
  uiLogMessageClassName,
} from "./utils";

describe("formatUiLogTimestamp", () => {
  it("formats ISO timestamps to hh:mm:ss", () => {
    expect(formatUiLogTimestamp("2026-02-14T19:40:05.000Z")).toBe("19:40:05");
  });

  it("returns original input when timestamp is invalid", () => {
    expect(formatUiLogTimestamp("not-a-timestamp")).toBe("not-a-timestamp");
  });
});

describe("uiLogLevelClassName", () => {
  it("returns expected classes per level", () => {
    expect(uiLogLevelClassName("info")).toBe("text-emerald-300");
    expect(uiLogLevelClassName("warn")).toBe("text-amber-200");
    expect(uiLogLevelClassName("error")).toBe("text-rose-300");
  });
});

describe("uiLogMessageClassName", () => {
  it("returns expected message classes per level", () => {
    expect(uiLogMessageClassName("info")).toBe("text-emerald-100");
    expect(uiLogMessageClassName("warn")).toBe("text-amber-50");
    expect(uiLogMessageClassName("error")).toBe("text-rose-100");
  });
});

describe("logsConnectionStateBadgeClassName", () => {
  it("returns expected styles for each connection state", () => {
    expect(logsConnectionStateBadgeClassName("live")).toBe(
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    );
    expect(logsConnectionStateBadgeClassName("connecting")).toBe(
      "border-amber-500/40 bg-amber-500/10 text-amber-200",
    );
    expect(logsConnectionStateBadgeClassName("offline")).toBe(
      "border-rose-500/40 bg-rose-500/10 text-rose-200",
    );
  });
});
