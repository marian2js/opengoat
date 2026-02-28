import { describe, expect, it } from "vitest";
import type { CliCommand } from "../../packages/cli/src/cli/framework/command.js";
import { CommandRouter } from "../../packages/cli/src/cli/framework/router.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

describe("CommandRouter", () => {
  it("prints help for empty argv", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const init: CliCommand = {
      path: ["init"],
      description: "init",
      async run(_args, _context) {
        return 0;
      }
    };

    const router = new CommandRouter([init], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    });

    const code = await router.dispatch([]);
    expect(code).toBe(0);
    expect(stdout.output()).toContain("OpenGoat CLI");
    expect(stdout.output()).toContain("Commands:");
  });

  it("prints help and returns 0 for help commands", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const router = new CommandRouter(
      [
        {
          path: ["init"],
          description: "initialize",
          async run() {
            return 0;
          }
        }
      ],
      { service: {} as never, stdout: stdout.stream, stderr: stderr.stream }
    );

    const code = await router.dispatch(["--help"]);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("OpenGoat CLI");
    expect(stdout.output()).toContain("Commands:");
  });

  it("returns 1 and prints guidance for unknown commands", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const router = new CommandRouter(
      [
        {
          path: ["init"],
          description: "initialize",
          async run() {
            return 0;
          }
        }
      ],
      { service: {} as never, stdout: stdout.stream, stderr: stderr.stream }
    );

    const code = await router.dispatch(["missing"]);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Unknown command: missing");
    expect(stdout.output()).toContain("Usage:");
  });

  it("prefers the most specific matching command path", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const called: string[] = [];

    const router = new CommandRouter(
      [
        {
          path: ["agent"],
          description: "generic",
          async run() {
            called.push("generic");
            return 0;
          }
        },
        {
          path: ["agent", "create"],
          description: "specific",
          async run() {
            called.push("specific");
            return 0;
          }
        },
        {
          path: ["init"],
          description: "init",
          async run() {
            return 0;
          }
        }
      ],
      { service: {} as never, stdout: stdout.stream, stderr: stderr.stream }
    );

    const code = await router.dispatch(["agent", "create", "goat"]);

    expect(code).toBe(0);
    expect(called).toEqual(["specific"]);
  });
});
