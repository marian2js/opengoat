import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodePathPort } from "../../../platform/node/node-path.port.js";
import { AgentService } from "./agent.service.js";

describe("AgentService workspace role skills", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("writes role skills to provider-specific directories", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-agent-service-skills-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const service = createService();

    await service.ensureAgent(
      paths,
      { id: "cto", displayName: "CTO" },
      { type: "manager", reportsTo: "goat" },
    );

    await service.ensureAgentWorkspaceRoleSkills(paths, "cto", {
      requiredSkillDirectories: ["skills"],
      managedSkillDirectories: ["skills", ".cursor/skills"],
      roleSkillIdsByType: {
        manager: ["og-boards"],
        individual: ["og-boards"],
      },
    });

    const sync = await service.ensureAgentWorkspaceRoleSkills(paths, "cto", {
      requiredSkillDirectories: [".cursor/skills"],
      managedSkillDirectories: ["skills", ".cursor/skills"],
      roleSkillIdsByType: {
        manager: ["og-boards"],
        individual: ["og-boards"],
      },
    });

    expect(
      await pathExists(
        path.join(
          paths.workspacesDir,
          "cto",
          ".cursor/skills/og-boards/SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      await pathExists(
        path.join(paths.workspacesDir, "cto", "skills", "og-boards"),
      ),
    ).toBe(false);
    expect(sync.removedPaths).toContain(
      path.join(paths.workspacesDir, "cto", "skills", "og-boards"),
    );
    const skillMarkdown = await readFile(
      path.join(paths.workspacesDir, "cto", ".cursor/skills/og-boards/SKILL.md"),
      "utf-8",
    );
    expect(skillMarkdown).toContain("Your agent id is `cto`.");
    expect(skillMarkdown).not.toContain("<me>");
  });

  it("supports nested provider skill directories like .agents/skills", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-agent-service-agents-skills-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const service = createService();

    await service.ensureAgent(
      paths,
      { id: "engineer", displayName: "Engineer" },
      { type: "individual", reportsTo: "goat" },
    );

    await service.ensureAgentWorkspaceRoleSkills(paths, "engineer", {
      requiredSkillDirectories: [".agents/skills"],
      managedSkillDirectories: [".agents/skills", "skills"],
      roleSkillIdsByType: {
        manager: ["og-boards"],
        individual: ["og-boards"],
      },
    });

    expect(
      await pathExists(
        path.join(
          paths.workspacesDir,
          "engineer",
          ".agents/skills/og-boards/SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      await pathExists(
        path.join(
          paths.workspacesDir,
          "engineer",
          "skills/og-boards/SKILL.md",
        ),
      ),
    ).toBe(false);
  });
});

function createService(): AgentService {
  return new AgentService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    nowIso: () => "2026-02-16T00:00:00.000Z",
  });
}

function createPaths(root: string): OpenGoatPaths {
  return {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    organizationDir: path.join(root, "organization"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json"),
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
