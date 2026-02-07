import { describe, expect, it } from "vitest";
import { StructuredLogger, createNoopLogger } from "./structured-logger.js";

describe("StructuredLogger", () => {
  it("filters messages by log level", () => {
    const records: Array<{ level: string; message: string }> = [];
    const logger = new StructuredLogger({
      level: "info",
      sink: (record) => records.push({ level: record.level, message: record.message }),
      nowIso: () => "2026-02-07T00:00:00.000Z"
    });

    logger.debug("debug");
    logger.info("info");
    logger.error("error");

    expect(records).toEqual([
      { level: "info", message: "info" },
      { level: "error", message: "error" }
    ]);
  });

  it("propagates child context bindings", () => {
    const records: Array<{ scope?: string; requestId?: string }> = [];
    const logger = new StructuredLogger({
      level: "debug",
      sink: (record) =>
        records.push({
          scope: record.context?.scope as string | undefined,
          requestId: record.context?.requestId as string | undefined
        }),
      nowIso: () => "2026-02-07T00:00:00.000Z"
    });

    const child = logger.child({ scope: "orchestration", requestId: "run-1" });
    child.debug("hello");

    expect(records).toEqual([{ scope: "orchestration", requestId: "run-1" }]);
  });

  it("returns stable noop logger", () => {
    const noop = createNoopLogger();
    const child = noop.child({ scope: "anything" });

    expect(noop.isLevelEnabled("error")).toBe(false);
    expect(child).toBe(noop);
  });
});

