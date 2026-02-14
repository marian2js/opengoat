import { describe, expect, it } from "vitest";
import { buildOpenGoatArgv, extractForwardedArgs } from "./argv.js";

describe("openclaw plugin argv forwarding", () => {
  it("extracts args after the opengoat command", () => {
    const forwarded = extractForwardedArgs(
      ["node", "openclaw", "opengoat", "agent", "list"],
      "opengoat",
    );

    expect(forwarded).toEqual(["agent", "list"]);
  });

  it("drops the pass-through separator token", () => {
    const forwarded = extractForwardedArgs(
      ["node", "openclaw", "opengoat", "--", "--help"],
      "opengoat",
    );

    expect(forwarded).toEqual(["--help"]);
  });

  it("returns an empty list when command is not present", () => {
    const forwarded = extractForwardedArgs(["node", "openclaw", "agent", "list"], "opengoat");

    expect(forwarded).toEqual([]);
  });

  it("combines base args and forwarded args", () => {
    const merged = buildOpenGoatArgv(["--log-level", "debug"], ["agent", "list"]);

    expect(merged).toEqual(["--log-level", "debug", "agent", "list"]);
  });
});
