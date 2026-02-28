import { describe, expect, it, vi } from "vitest";
import { skillCommand } from "../../packages/cli/src/cli/commands/skill.command.js";
import { skillInstallCommand } from "../../packages/cli/src/cli/commands/skill-install.command.js";
import { skillListCommand } from "../../packages/cli/src/cli/commands/skill-list.command.js";
import { skillRemoveCommand } from "../../packages/cli/src/cli/commands/skill-remove.command.js";
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
    expect(stdout.output()).toContain("opengoat skill remove");
  });

  it("lists skills with default agent", async () => {
    const listSkills = vi.fn(async () => [
      {
        id: "code-review",
        name: "Code Review",
        description: "Review code changes.",
        source: "managed",
        skillFilePath: "/tmp/workspace/skills/code-review/SKILL.md"
      }
    ]);
    const { context, stdout } = createContext({ listSkills });

    const code = await skillListCommand.run([], context);

    expect(code).toBe(0);
    expect(listSkills).toHaveBeenCalledWith("goat");
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
      sourceUrl: undefined,
      sourceSkillName: undefined,
      description: undefined,
      scope: "agent",
      assignToAllAgents: false
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
      sourceUrl: undefined,
      sourceSkillName: undefined,
      description: undefined,
      scope: "global",
      assignToAllAgents: false
    });
    expect(stdout.output()).toContain("Scope: global");
    expect(stdout.output()).toContain("Installed skill: global-helper");
  });

  it("installs a global skill from URL for all agents", async () => {
    const installSkill = vi.fn(async () => ({
      scope: "global",
      skillId: "frontend-design",
      skillName: "frontend-design",
      source: "source-url",
      installedPath: "/tmp/opengoat/skills/frontend-design/SKILL.md",
      assignedAgentIds: ["goat", "developer"],
      workspaceInstallPaths: [
        "/tmp/workspaces/goat/skills/frontend-design/SKILL.md",
        "/tmp/workspaces/developer/.agents/skills/frontend-design/SKILL.md",
      ],
      replaced: true,
    }));
    const { context, stdout } = createContext({ installSkill });

    const code = await skillInstallCommand.run(
      [
        "frontend-design",
        "--global",
        "--all-agents",
        "--from-url",
        "https://github.com/anthropics/skills",
        "--source-skill",
        "frontend-design",
      ],
      context,
    );

    expect(code).toBe(0);
    expect(installSkill).toHaveBeenCalledWith({
      agentId: undefined,
      skillName: "frontend-design",
      sourcePath: undefined,
      sourceUrl: "https://github.com/anthropics/skills",
      sourceSkillName: "frontend-design",
      description: undefined,
      scope: "global",
      assignToAllAgents: true,
    });
    expect(stdout.output()).toContain("Assigned agents: goat, developer");
    expect(stdout.output()).toContain("Workspace installs: 2");
  });

  it("rejects --all-agents without --global", async () => {
    const installSkill = vi.fn(async () => ({
      scope: "agent",
    }));
    const { context, stderr } = createContext({ installSkill });

    const code = await skillInstallCommand.run(
      ["frontend-design", "--all-agents"],
      context,
    );

    expect(code).toBe(1);
    expect(stderr.output()).toContain("--all-agents requires --global.");
    expect(installSkill).not.toHaveBeenCalled();
  });

  it("removes an agent skill with default scope", async () => {
    const removeSkill = vi.fn(async () => ({
      scope: "agent",
      agentId: "goat",
      skillId: "frontend-design",
      removedFromGlobal: false,
      removedFromAgentIds: ["goat"],
      removedWorkspacePaths: ["/tmp/workspaces/goat/skills/frontend-design/SKILL.md"],
    }));
    const { context, stdout } = createContext({ removeSkill });

    const code = await skillRemoveCommand.run(["frontend-design"], context);

    expect(code).toBe(0);
    expect(removeSkill).toHaveBeenCalledWith({
      scope: "agent",
      agentId: "goat",
      skillId: "frontend-design",
    });
    expect(stdout.output()).toContain("Removed skill: frontend-design");
    expect(stdout.output()).toContain("Target agent: goat");
  });

  it("removes a global skill with --global", async () => {
    const removeSkill = vi.fn(async () => ({
      scope: "global",
      skillId: "qa-checklist",
      removedFromGlobal: true,
      removedFromAgentIds: ["goat", "developer"],
      removedWorkspacePaths: [
        "/tmp/workspaces/goat/skills/qa-checklist/SKILL.md",
        "/tmp/workspaces/developer/.agents/skills/qa-checklist/SKILL.md",
      ],
    }));
    const { context, stdout } = createContext({ removeSkill });

    const code = await skillRemoveCommand.run(
      ["qa-checklist", "--global"],
      context,
    );

    expect(code).toBe(0);
    expect(removeSkill).toHaveBeenCalledWith({
      scope: "global",
      agentId: undefined,
      skillId: "qa-checklist",
    });
    expect(stdout.output()).toContain("Scope: global");
    expect(stdout.output()).toContain("Removed from global storage.");
    expect(stdout.output()).toContain("Workspace removals: 2");
  });
});
