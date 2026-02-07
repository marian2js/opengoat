import { describe, expect, it } from "vitest";
import { callWithProcedureFallback, isMissingQueryProcedureError } from "./workbench-store";

describe("workbench store fallback helpers", () => {
  it("retries on missing procedure errors and returns first successful result", async () => {
    const result = await callWithProcedureFallback<string>([
      async () => {
        throw new Error('No "query"-procedure on path "bootstrap"');
      },
      async () => {
        throw new Error('No "mutation"-procedure on path "bootstrapMutate"');
      },
      async () => "ok"
    ]);

    expect(result).toBe("ok");
  });

  it("does not swallow non-procedure errors", async () => {
    await expect(
      callWithProcedureFallback([
        async () => {
          throw new Error("Network timeout");
        },
        async () => "never reached"
      ])
    ).rejects.toThrow("Network timeout");
  });

  it("recognizes both query and mutation missing-procedure errors", () => {
    expect(isMissingQueryProcedureError(new Error('No "query"-procedure on path "a"'))).toBe(true);
    expect(isMissingQueryProcedureError(new Error('No "mutation"-procedure on path "b"'))).toBe(true);
    expect(isMissingQueryProcedureError(new Error("Something else"))).toBe(false);
  });
});
