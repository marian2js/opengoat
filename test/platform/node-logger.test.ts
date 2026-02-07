import { describe, expect, it } from "vitest";
import { createNodeLogger } from "../../src/platform/node/node-logger.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

describe("createNodeLogger", () => {
  it("writes JSON log records when format=json", () => {
    const capture = createStreamCapture();
    const logger = createNodeLogger({
      level: "debug",
      format: "json",
      stream: capture.stream
    });

    logger.info("hello", { scope: "cli", action: "run" });
    const output = capture.output().trim();
    const parsed = JSON.parse(output) as {
      level: string;
      message: string;
      context?: Record<string, unknown>;
    };

    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello");
    expect(parsed.context?.scope).toBe("cli");
    expect(parsed.context?.action).toBe("run");
  });

  it("filters out info logs when configured at warn", () => {
    const capture = createStreamCapture();
    const logger = createNodeLogger({
      level: "warn",
      format: "pretty",
      stream: capture.stream
    });

    logger.info("ignored");
    logger.warn("visible");

    const output = capture.output();
    expect(output).not.toContain("ignored");
    expect(output).toContain("visible");
  });

  it("renders multiline context fields in pretty format", () => {
    const capture = createStreamCapture();
    const logger = createNodeLogger({
      level: "debug",
      format: "pretty",
      stream: capture.stream
    });

    logger.debug("planner payload", {
      scope: "orchestration-service",
      step: 1,
      prompt: "line one\nline two",
      nested: {
        mode: "direct"
      }
    });

    const output = capture.output();
    expect(output).toContain("DEBUG orchestration-service planner payload");
    expect(output).toContain("\n  prompt: |\n    line one\n    line two");
    expect(output).toContain("\n  nested:\n");
    expect(output).toContain('"mode": "direct"');
  });
});
