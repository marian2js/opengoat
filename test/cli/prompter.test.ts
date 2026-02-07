import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createCliPrompter } from "../../packages/cli/src/cli/framework/prompter.js";

describe("cli prompter", () => {
  it("uses readline fallback and supports numeric select", async () => {
    const { stdin, stdout, stderr, output } = createPromptIo("2\n");
    const prompter = createCliPrompter({ stdin, stdout, stderr });

    const selected = await prompter.select(
      "Choose provider",
      [
        { value: "openai", label: "OpenAI" },
        { value: "codex", label: "Codex" }
      ],
      "openai"
    );

    expect(selected).toBe("codex");
    expect(output()).toContain("Choose provider");
  });

  it("reads text input in fallback mode", async () => {
    const { stdin, stdout, stderr, errorOutput } = createPromptIo("valid\n");
    const prompter = createCliPrompter({ stdin, stdout, stderr });

    const value = await prompter.text({
      message: "Enter token",
      required: true
    });

    expect(value).toBe("valid");
    expect(errorOutput()).toBe("");
  });
});

function createPromptIo(rawInput: string): {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  output: () => string;
  errorOutput: () => string;
} {
  const stdin = new PassThrough() as PassThrough & { isTTY?: boolean };
  const stdout = new PassThrough() as PassThrough & { isTTY?: boolean };
  const stderr = new PassThrough() as PassThrough & { isTTY?: boolean };

  stdin.isTTY = false;
  stdout.isTTY = false;
  stderr.isTTY = false;

  let out = "";
  let err = "";
  stdout.on("data", (chunk: Buffer | string) => {
    out += chunk.toString();
  });
  stderr.on("data", (chunk: Buffer | string) => {
    err += chunk.toString();
  });

  stdin.end(rawInput);

  return {
    stdin,
    stdout,
    stderr,
    output: () => out,
    errorOutput: () => err
  };
}
