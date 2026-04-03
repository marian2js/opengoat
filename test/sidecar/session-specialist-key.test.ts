import { describe, expect, it } from "vitest";
import { parseSpecialistFromKey } from "../../packages/sidecar/src/internal-gateway/gateway-client.ts";

describe("parseSpecialistFromKey", () => {
  it("extracts specialistId from a specialist session key", () => {
    const key = "agent:goat:session:specialist:market-intel:abc-123";
    expect(parseSpecialistFromKey(key)).toBe("market-intel");
  });

  it("extracts specialistId with different specialist ids", () => {
    expect(parseSpecialistFromKey("agent:goat:session:specialist:seo-aeo:uuid-1")).toBe("seo-aeo");
    expect(parseSpecialistFromKey("agent:goat:session:specialist:outbound:uuid-2")).toBe("outbound");
    expect(parseSpecialistFromKey("agent:goat:session:specialist:cmo:uuid-3")).toBe("cmo");
  });

  it("returns undefined for regular session keys", () => {
    const key = "agent:goat:session:abc-123";
    expect(parseSpecialistFromKey(key)).toBeUndefined();
  });

  it("returns undefined for internal session keys", () => {
    const key = "agent:goat:session:internal:abc-123";
    expect(parseSpecialistFromKey(key)).toBeUndefined();
  });

  it("returns undefined for main session keys", () => {
    const key = "agent:goat:main";
    expect(parseSpecialistFromKey(key)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseSpecialistFromKey("")).toBeUndefined();
  });
});
