import { describe, expect, it } from "vitest";
import { isUnnamedSession } from "../../apps/desktop/src/lib/utils/unnamed-session";

describe("isUnnamedSession", () => {
  it("returns true for undefined label", () => {
    expect(isUnnamedSession(undefined)).toBe(true);
  });

  it("returns true for empty string label", () => {
    expect(isUnnamedSession("")).toBe(true);
  });

  it("returns true for 'New conversation'", () => {
    expect(isUnnamedSession("New conversation")).toBe(true);
  });

  it("returns true for 'new conversation' (case insensitive)", () => {
    expect(isUnnamedSession("new conversation")).toBe(true);
  });

  it("returns true for 'New chat'", () => {
    expect(isUnnamedSession("New chat")).toBe(true);
  });

  it("returns true for 'new chat' (case insensitive)", () => {
    expect(isUnnamedSession("new chat")).toBe(true);
  });

  it("returns true for 'Untitled chat'", () => {
    expect(isUnnamedSession("Untitled chat")).toBe(true);
  });

  it("returns true for 'untitled chat' (case insensitive)", () => {
    expect(isUnnamedSession("untitled chat")).toBe(true);
  });

  it("returns true for 'Untitled'", () => {
    expect(isUnnamedSession("Untitled")).toBe(true);
  });

  it("returns false for a named conversation", () => {
    expect(isUnnamedSession("Fair Value: MSFT")).toBe(false);
  });

  it("returns false for 'Morning Brief'", () => {
    expect(isUnnamedSession("Morning Brief")).toBe(false);
  });

  it("returns false for 'Breakout Setups'", () => {
    expect(isUnnamedSession("Breakout Setups")).toBe(false);
  });

  it("returns true for whitespace-only label", () => {
    expect(isUnnamedSession("   ")).toBe(true);
  });

  it("returns true for 'New conversation' with extra whitespace", () => {
    expect(isUnnamedSession("  New conversation  ")).toBe(true);
  });
});
