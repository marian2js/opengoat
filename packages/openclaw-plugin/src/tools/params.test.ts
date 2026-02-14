import { describe, expect, it } from "vitest";
import {
  asRecord,
  normalizeNullableManagerId,
  readOptionalBoolean,
  readOptionalNumber,
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  resolveAgentId,
} from "./params.js";

describe("tool params helpers", () => {
  it("reads optional strings and trims whitespace", () => {
    const value = readOptionalString({ a: "  hello  " }, "a");
    expect(value).toBe("hello");
    expect(readOptionalString({ a: "  " }, "a")).toBeUndefined();
  });

  it("throws for missing required string", () => {
    expect(() => readRequiredString({}, "x")).toThrow(
      "Missing required parameter: x",
    );
  });

  it("reads optional primitives and arrays", () => {
    expect(readOptionalBoolean({ ok: true }, "ok")).toBe(true);
    expect(readOptionalNumber({ n: 42 }, "n")).toBe(42);
    expect(readOptionalStringArray({ ids: [" a ", "", 1] }, "ids")).toEqual([
      "a",
    ]);
  });

  it("resolves normalized agent ids with fallback", () => {
    expect(resolveAgentId(" CTO ", undefined)).toBe("cto");
    expect(resolveAgentId(undefined, " Eng Lead ")).toBe("eng-lead");
    expect(resolveAgentId(undefined, undefined)).toBe("ceo");
  });

  it("normalizes nullable manager ids", () => {
    expect(normalizeNullableManagerId("none")).toBeNull();
    expect(normalizeNullableManagerId("CTO")).toBe("cto");
  });

  it("coerces non-record inputs into empty records", () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord([])).toEqual({});
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });
});
