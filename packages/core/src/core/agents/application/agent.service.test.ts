import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodePathPort } from "../../../platform/node/node-path.port.js";
import { AgentService, normalizeAgentsMarkdown } from "./agent.service.js";

describe("normalizeAgentsMarkdown", () => {
  const INPUT_WITH_EVERY_SESSION = [
    "# AGENTS.md",
    "",
    "## Every Session",
    "",
    "Old content that should be replaced.",
    "",
  ].join("\n");

  it("includes the Available Marketing Skills section", () => {
    const result = normalizeAgentsMarkdown(INPUT_WITH_EVERY_SESSION, {
      keepFirstRunSection: false,
    });
    expect(result).toContain("## Available Marketing Skills");
  });

  it("includes all 10 domain rows in the skill table", () => {
    const result = normalizeAgentsMarkdown(INPUT_WITH_EVERY_SESSION, {
      keepFirstRunSection: false,
    });
    const expectedDomains = [
      "SEO",
      "CRO",
      "Copy & Content",
      "Email",
      "Ads",
      "Analytics",
      "Growth",
      "Strategy",
      "Sales",
      "Foundation",
    ];
    for (const domain of expectedDomains) {
      expect(result).toContain(`| ${domain} |`);
    }
  });

  it("includes correct skill paths", () => {
    const result = normalizeAgentsMarkdown(INPUT_WITH_EVERY_SESSION, {
      keepFirstRunSection: false,
    });
    expect(result).toContain("./skills/marketing/");
    expect(result).toContain("./skills/personas/");
  });

  it("includes the discovery instruction", () => {
    const result = normalizeAgentsMarkdown(INPUT_WITH_EVERY_SESSION, {
      keepFirstRunSection: false,
    });
    expect(result).toContain(
      "read the relevant SKILL.md before responding",
    );
  });

  it("includes the personas line", () => {
    const result = normalizeAgentsMarkdown(INPUT_WITH_EVERY_SESSION, {
      keepFirstRunSection: false,
    });
    expect(result).toContain("Personas: seo-specialist");
    expect(result).toContain("ux-researcher");
  });
});

describe("AgentService workspace role skills", () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();

  afterEach(async () => {
    process.chdir(originalCwd);
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

  it("writes workspace shim with absolute launcher path when a local bin/opengoat is discoverable", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-agent-service-shim-"));
    tempDirs.push(tempDir);
    const paths = createPaths(path.join(tempDir, "home"));
    const service = createService();
    const binDir = path.join(tempDir, "bin");
    const launcherPath = path.join(binDir, "opengoat");
    await rm(binDir, { recursive: true, force: true });
    await new NodeFileSystem().ensureDir(binDir);
    await new NodeFileSystem().writeFile(
      launcherPath,
      "#!/usr/bin/env node\nconsole.log('shim');\n",
    );

    process.chdir(tempDir);
    await service.ensureAgent(
      paths,
      { id: "sage", displayName: "Sage" },
      { type: "manager", reportsTo: "goat" },
    );
    await service.ensureAgentWorkspaceCommandShim(paths, "sage");

    const shimContent = await readFile(
      path.join(paths.workspacesDir, "sage", "opengoat"),
      "utf-8",
    );
    expect(shimContent).toContain(
      `exec ${quoteForShellTest(process.execPath)} `,
    );
    expect(shimContent).toContain("/bin/opengoat' \"$@\"");
  });

  it("falls back to PATH-based opengoat shim when no local launcher is found", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-agent-service-shim-fallback-"));
    tempDirs.push(tempDir);
    const homeDir = path.join(tempDir, "home");
    const paths = createPaths(homeDir);
    const service = createService();
    await new NodeFileSystem().ensureDir(homeDir);

    process.chdir(homeDir);
    await service.ensureAgent(
      paths,
      { id: "alex", displayName: "Alex" },
      { type: "individual", reportsTo: "sage" },
    );
    await service.ensureAgentWorkspaceCommandShim(paths, "alex");

    const shimContent = await readFile(
      path.join(paths.workspacesDir, "alex", "opengoat"),
      "utf-8",
    );
    expect(shimContent).toContain('exec opengoat "$@"');
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

function quoteForShellTest(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}
