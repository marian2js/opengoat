import { describe, expect, it } from "vitest";
import {
  isInternalSessionKey,
  INTERNAL_SESSION_PREFIX,
  SESSION_STORE_SCHEMA_VERSION,
  SESSION_TRANSCRIPT_SCHEMA_VERSION,
} from "./session.js";

describe("isInternalSessionKey", () => {
  it("matches the legacy prefix format", () => {
    expect(isInternalSessionKey("session:internal:bootstrap-product")).toBe(true);
  });

  it("matches the legacy prefix with agent id embedded", () => {
    expect(
      isInternalSessionKey("session:internal:capyfin-main:abc-123"),
    ).toBe(true);
  });

  it("matches the agent-scoped format produced by the gateway", () => {
    expect(
      isInternalSessionKey("agent:capyfin-main:session:internal:abc-123"),
    ).toBe(true);
  });

  it("matches the agent-scoped format for the default main agent", () => {
    expect(
      isInternalSessionKey("agent:main:session:internal:capyfin-main:abc-123"),
    ).toBe(true);
  });

  it("rejects regular agent session keys", () => {
    expect(isInternalSessionKey("agent:main:session:abc-123")).toBe(false);
  });

  it("rejects the main session key", () => {
    expect(isInternalSessionKey("agent:main:main")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isInternalSessionKey("")).toBe(false);
  });

  it("rejects keys that merely contain 'internal' without the full marker", () => {
    expect(isInternalSessionKey("agent:internal-team:session:abc")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isInternalSessionKey("Session:Internal:foo")).toBe(true);
    expect(
      isInternalSessionKey("AGENT:MAIN:SESSION:INTERNAL:bar"),
    ).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isInternalSessionKey("  session:internal:foo  ")).toBe(true);
  });
});

describe("session constants", () => {
  it("exports the internal session prefix", () => {
    expect(INTERNAL_SESSION_PREFIX).toBe("session:internal:");
  });

  it("exports schema versions", () => {
    expect(SESSION_STORE_SCHEMA_VERSION).toBe(1);
    expect(SESSION_TRANSCRIPT_SCHEMA_VERSION).toBe(1);
  });
});
