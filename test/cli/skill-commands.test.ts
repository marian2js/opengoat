import { describe, expect, it, vi } from "vitest";
import { skillCommand } from "../../src/apps/cli/commands/skill.command.js";
import { skillInstallCommand } from "../../src/apps/cli/commands/skill-install.command.js";
import { skillListCommand } from "../../src/apps/cli/commands/skill-list.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    },
    stdout,
    stderr
  };
}

describe("skill commands", () => {
  it("prints root skill help", async () => {
    const { context, stdout } = createContext({});
    const code = await skillCommand.run([], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat skill list");
    expect(stdout.output()).toContain("opengoat skill install");
  });

  it("lists skills with default agent", async () => {
    const listSkills = vi.fn(async () => [
      {
        id: "code-review",
        name: "Code Review",
        description: "Review code changes.",
        source: "workspace",
        skillFilePath: "/tmp/workspace/skills/code-review/SKILL.md"
      }
    ]);
    const { context, stdout } = createContext({ listSkills });

    const code = await skillListCommand.run([], context);

    expect(code).toBe(0);
    expect(listSkills).toHaveBeenCalledWith("orchestrator");
    expect(stdout.output()).toContain("code-review");
  });

  it("lists global skills with --global", async () => {
    const listGlobalSkills = vi.fn(async () => [
      {
        id: "global-helper",
        name: "Global Helper",
        description: "Global reusable instructions.",
        source: "managed",
        skillFilePath: "/tmp/opengoat/skills/global-helper/SKILL.md"
      }
    ]);
    const { context, stdout } = createContext({ listGlobalSkills });

    const code = await skillListCommand.run(["--global"], context);

    expect(code).toBe(0);
    expect(listGlobalSkills).toHaveBeenCalled();
    expect(stdout.output()).toContain("Scope: global");
    expect(stdout.output()).toContain("global-helper");
  });

  it("installs a skill via CLI args", async () => {
    const installSkill = vi.fn(async () => ({
      scope: "agent",
      agentId: "developer",
      skillId: "code-review",
      skillName: "Code Review",
      source: "source-path",
      installedPath: "/tmp/workspaces/developer/skills/code-review/SKILL.md",
      replaced: false
    }));
    const { context, stdout } = createContext({ installSkill });

    const code = await skillInstallCommand.run(
      ["Code Review", "--agent", "developer", "--from", "/tmp/skills/code-review"],
      context
    );

    expect(code).toBe(0);
    expect(installSkill).toHaveBeenCalledWith({
      agentId: "developer",
      skillName: "Code Review",
      sourcePath: "/tmp/skills/code-review",
      description: undefined,
      scope: "agent"
    });
    expect(stdout.output()).toContain("Installed skill: code-review");
  });

  it("installs a global skill via CLI args", async () => {
    const installSkill = vi.fn(async () => ({
      scope: "global",
      skillId: "global-helper",
      skillName: "Global Helper",
      source: "generated",
      installedPath: "/tmp/opengoat/skills/global-helper/SKILL.md",
      replaced: false
    }));
    const { context, stdout } = createContext({ installSkill });

    const code = await skillInstallCommand.run(["Global Helper", "--global"], context);

    expect(code).toBe(0);
    expect(installSkill).toHaveBeenCalledWith({
      agentId: undefined,
      skillName: "Global Helper",
      sourcePath: undefined,
      description: undefined,
      scope: "global"
    });
    expect(stdout.output()).toContain("Scope: global");
    expect(stdout.output()).toContain("Installed skill: global-helper");
  });
});
