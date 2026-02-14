import { describe, expect, it, vi } from "vitest";
import { createOpenGoatCliRegistrar, type OpenGoatRunner } from "./cli-registrar.js";
import type { OpenGoatPluginConfig } from "./config.js";
import type { CliCommandLike, CliProgramLike, PluginLogger } from "./openclaw-types.js";

class FakeCommand implements CliCommandLike {
  public actionHandler: (() => Promise<void> | void) | undefined;

  public description(_text: string): CliCommandLike {
    return this;
  }

  public allowUnknownOption(_allow?: boolean): CliCommandLike {
    return this;
  }

  public allowExcessArguments(_allow?: boolean): CliCommandLike {
    return this;
  }

  public passThroughOptions(_allow?: boolean): CliCommandLike {
    return this;
  }

  public argument(_definition: string, _description?: string): CliCommandLike {
    return this;
  }

  public action(handler: (...args: unknown[]) => void | Promise<void>): CliCommandLike {
    this.actionHandler = () => handler();
    return this;
  }
}

class FakeProgram implements CliProgramLike {
  public readonly commandInstance = new FakeCommand();
  public commandName: string | undefined;

  public command(nameAndArgs: string): CliCommandLike {
    this.commandName = nameAndArgs;
    return this.commandInstance;
  }
}

const logger: PluginLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const pluginConfig: OpenGoatPluginConfig = {
  command: "custom-opengoat",
  baseArgs: [],
  env: {},
};

describe("openclaw plugin cli registrar", () => {
  it("registers an opengoat command and forwards raw args", async () => {
    const runner: OpenGoatRunner = vi.fn().mockResolvedValue({ exitCode: 0, signal: null });
    const program = new FakeProgram();

    const registrar = createOpenGoatCliRegistrar({
      logger,
      config: pluginConfig,
      runOpenGoat: runner,
    });

    const originalArgv = process.argv;
    process.argv = ["node", "openclaw", "opengoat", "agent", "list"];

    try {
      await registrar({ program });
      await program.commandInstance.actionHandler?.();
    } finally {
      process.argv = originalArgv;
    }

    expect(program.commandName).toBe("opengoat");
    expect(runner).toHaveBeenCalledWith({
      command: "custom-opengoat",
      args: ["agent", "list"],
      cwd: undefined,
      env: {},
    });
  });

  it("applies base args and sets process exit code on failure", async () => {
    const runner: OpenGoatRunner = vi.fn().mockResolvedValue({ exitCode: 2, signal: null });
    const program = new FakeProgram();

    const registrar = createOpenGoatCliRegistrar({
      logger,
      config: {
        command: "custom-opengoat",
        baseArgs: ["--log-format", "json"],
        cwd: "/tmp/goat",
        env: { FOO: "bar" },
      },
      runOpenGoat: runner,
    });

    const originalArgv = process.argv;
    const originalExitCode = process.exitCode;
    let observedExitCode: number | undefined;
    process.argv = ["node", "openclaw", "opengoat", "--", "--help"];
    process.exitCode = undefined;

    try {
      await registrar({ program });
      await program.commandInstance.actionHandler?.();
      observedExitCode = process.exitCode;
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
    }

    expect(runner).toHaveBeenCalledWith({
      command: "custom-opengoat",
      args: ["--log-format", "json", "--help"],
      cwd: "/tmp/goat",
      env: { FOO: "bar" },
    });
    expect(observedExitCode).toBe(2);
  });
});
