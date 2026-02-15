import { describe, expect, it } from "vitest";
import { resolveCreateOpenGoatRuntime } from "./runtime.js";

describe("resolveCreateOpenGoatRuntime", () => {
  it("reads named createOpenGoatRuntime export", () => {
    const createOpenGoatRuntime = () => ({
      service: { initialize: async () => undefined },
      logger: {},
    });

    const resolved = resolveCreateOpenGoatRuntime({
      createOpenGoatRuntime,
    });

    expect(resolved).toBe(createOpenGoatRuntime);
  });

  it("reads createOpenGoatRuntime from default export namespace", () => {
    const createOpenGoatRuntime = () => ({
      service: { initialize: async () => undefined },
      logger: {},
    });

    const resolved = resolveCreateOpenGoatRuntime({
      default: {
        createOpenGoatRuntime,
      },
    });

    expect(resolved).toBe(createOpenGoatRuntime);
  });

  it("returns undefined when the export is missing", () => {
    expect(resolveCreateOpenGoatRuntime({})).toBeUndefined();
    expect(
      resolveCreateOpenGoatRuntime({
        default: {},
      }),
    ).toBeUndefined();
  });
});
