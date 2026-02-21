import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillService } from "../../packages/core/src/core/skills/index.js";
import type {
  CommandRunRequest,
  CommandRunResult,
  CommandRunnerPort,
} from "../../packages/core/src/core/ports/command-runner.port.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import {
  TestPathsProvider,
  createTempDir,
  removeTempDir,
} from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("SkillService", () => {
  it("lists only assigned centralized skills for an agent", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const managedPath = path.join(paths.skillsDir, "code-review");
    await fileSystem.ensureDir(managedPath);
    await fileSystem.writeFile(
      path.join(managedPath, "SKILL.md"),
      [
        "---",
        "name: Code Review",
        "description: Managed description",
        "---",
        "",
        "# Managed",
      ].join("\n"),
    );

    await setAssignedSkills(fileSystem, paths, ["code-review"]);

    const skills = await service.listSkills(paths, "ceo");
    expect(skills).toHaveLength(1);
    expect(skills[0]?.source).toBe("managed");
    expect(skills[0]?.id).toBe("code-review");
  });

  it("builds an agent skills prompt with skill entries", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const skillPath = path.join(paths.skillsDir, "deploy-checklist");
    await fileSystem.ensureDir(skillPath);
    await fileSystem.writeFile(
      path.join(skillPath, "SKILL.md"),
      [
        "---",
        "name: Deploy Checklist",
        "description: Release process",
        "---",
        "",
        "# Deploy",
        "",
        "- Step A",
      ].join("\n"),
    );
    await setAssignedSkills(fileSystem, paths, ["deploy-checklist"]);

    const prompt = await service.buildSkillsPrompt(paths, "ceo");
    expect(prompt.prompt).toContain("## Skills");
    expect(prompt.prompt).toContain("<available_skills>");
    expect(prompt.prompt).toContain("deploy-checklist");
    expect(prompt.prompt).toContain(
      "global and agent-specific stores",
    );
  });

  it("omits disable-model-invocation skills from prompt while keeping them installed", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const skillPath = path.join(paths.skillsDir, "hidden-skill");
    await fileSystem.ensureDir(skillPath);
    await fileSystem.writeFile(
      path.join(skillPath, "SKILL.md"),
      [
        "---",
        "name: Hidden Skill",
        "description: Should not be injected into model prompt",
        "disable-model-invocation: true",
        "---",
        "",
        "# Hidden",
      ].join("\n"),
    );
    await setAssignedSkills(fileSystem, paths, ["hidden-skill"]);

    const allSkills = await service.listSkills(paths, "ceo");
    expect(allSkills.some((skill) => skill.id === "hidden-skill")).toBe(true);

    const prompt = await service.buildSkillsPrompt(paths, "ceo");
    expect(prompt.prompt).not.toContain("hidden-skill");
  });

  it("loads extra-dir skills when assigned", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const extraSkillsRoot = path.join(paths.homeDir, "extra-skills");

    const extraSkillDir = path.join(extraSkillsRoot, "release-audit");
    await fileSystem.ensureDir(extraSkillDir);
    await fileSystem.writeFile(
      path.join(extraSkillDir, "SKILL.md"),
      [
        "---",
        "name: Release Audit",
        "description: Extra-dir skill",
        "---",
        "",
        "# Audit",
      ].join("\n"),
    );
    await setAssignedSkills(fileSystem, paths, ["release-audit"]);
    await writeFile(
      path.join(paths.agentsDir, "ceo", "config.json"),
      JSON.stringify(
        {
          schemaVersion: 2,
          id: "ceo",
          runtime: {
            skills: {
              enabled: true,
              includeManaged: true,
              assigned: ["release-audit"],
              load: {
                extraDirs: [extraSkillsRoot],
              },
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const skills = await service.listSkills(paths, "ceo");
    expect(skills).toHaveLength(1);
    expect(skills[0]?.source).toBe("extra");
    expect(skills[0]?.id).toBe("release-audit");
  });

  it("installs from source path and assigns to agent", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const sourceSkillDir = path.join(paths.homeDir, "tmp-source-skill");
    await fileSystem.ensureDir(sourceSkillDir);
    await fileSystem.writeFile(
      path.join(sourceSkillDir, "SKILL.md"),
      [
        "---",
        "name: Local Skill",
        "description: Source path skill",
        "---",
        "",
        "# Local",
      ].join("\n"),
    );
    await fileSystem.writeFile(
      path.join(sourceSkillDir, "references.md"),
      "extra\n",
    );

    const result = await service.installSkill(paths, {
      agentId: "ceo",
      skillName: "local-skill",
      sourcePath: sourceSkillDir,
    });

    expect(result.source).toBe("source-path");
    expect(await readFile(result.installedPath, "utf8")).toContain(
      "Local Skill",
    );
    expect(
      await readFile(
        path.join(path.dirname(result.installedPath), "references.md"),
        "utf8",
      ),
    ).toContain("extra");

    const config = JSON.parse(
      await readFile(path.join(paths.agentsDir, "ceo", "config.json"), "utf8"),
    ) as {
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(config.runtime?.skills?.assigned).toContain("local-skill");
    expect(await fileSystem.exists(path.join(paths.skillsDir, "local-skill"))).toBe(
      false,
    );
    expect(result.installedPath).toContain(
      `${path.sep}.agent-scoped${path.sep}ceo${path.sep}local-skill${path.sep}SKILL.md`,
    );
  });

  it("installs a skill into provider-specific workspace directories", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const sourceSkillDir = path.join(paths.homeDir, "workspace-source-skill");
    await fileSystem.ensureDir(sourceSkillDir);
    await fileSystem.writeFile(
      path.join(sourceSkillDir, "SKILL.md"),
      [
        "---",
        "name: Cursor Local Skill",
        "description: Provider-specific workspace install",
        "---",
        "",
        "# Cursor Local Skill",
      ].join("\n"),
    );

    const result = await service.installSkill(
      paths,
      {
        agentId: "ceo",
        skillName: "cursor-local-skill",
        sourcePath: sourceSkillDir,
      },
      {
        workspaceDir: path.join(paths.workspacesDir, "ceo"),
        workspaceSkillDirectories: [".agents/skills"],
      },
    );

    expect(result.workspaceInstallPaths).toEqual([
      path.join(
        paths.workspacesDir,
        "ceo",
        ".agents",
        "skills",
        "cursor-local-skill",
        "SKILL.md",
      ),
    ]);
    const workspaceSkillMarkdown = await readFile(
      path.join(
        paths.workspacesDir,
        "ceo",
        ".agents",
        "skills",
        "cursor-local-skill",
        "SKILL.md",
      ),
      "utf8",
    );
    expect(workspaceSkillMarkdown).toContain("Cursor Local Skill");
  });

  it("installs from URL by cloning the source repository and resolving source skill", async () => {
    const sourceRepositoryRoot = await createTempDir("opengoat-skill-repo-");
    roots.push(sourceRepositoryRoot);
    const sourceSkillDir = path.join(
      sourceRepositoryRoot,
      "skills",
      "frontend-design",
    );
    await new NodeFileSystem().ensureDir(sourceSkillDir);
    await new NodeFileSystem().writeFile(
      path.join(sourceSkillDir, "SKILL.md"),
      [
        "---",
        "name: frontend-design",
        "description: Frontend design workflow",
        "---",
        "",
        "# Frontend design workflow",
      ].join("\n"),
    );

    const commandRunner: CommandRunnerPort = {
      run: async (
        request: CommandRunRequest,
      ): Promise<CommandRunResult> => {
        if (
          request.command === "git" &&
          request.args[0] === "clone" &&
          request.args[1] === "--depth" &&
          request.args[2] === "1"
        ) {
          const destinationDir = request.args[4];
          if (!destinationDir) {
            return {
              code: 1,
              stdout: "",
              stderr: "Missing destination dir",
            };
          }
          await cp(sourceRepositoryRoot, destinationDir, {
            recursive: true,
            force: true,
          });
          return {
            code: 0,
            stdout: "",
            stderr: "",
          };
        }
        return {
          code: 1,
          stdout: "",
          stderr: `Unsupported command: ${request.command}`,
        };
      },
    };

    const { service, paths, fileSystem } = await createHarness({
      commandRunner,
    });
    const result = await service.installSkill(paths, {
      agentId: "ceo",
      skillName: "frontend-design",
      sourceUrl: "https://github.com/anthropics/skills",
      sourceSkillName: "frontend-design",
    });

    expect(result.skillId).toBe("frontend-design");
    expect(result.source).toBe("source-url");
    expect(await readFile(result.installedPath, "utf8")).toContain(
      "Frontend design workflow",
    );
    const config = JSON.parse(
      await readFile(path.join(paths.agentsDir, "ceo", "config.json"), "utf8"),
    ) as {
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(config.runtime?.skills?.assigned).toContain("frontend-design");
    expect(
      await fileSystem.exists(path.join(paths.skillsDir, "frontend-design")),
    ).toBe(false);
  });

  it("installs and lists global managed skills", async () => {
    const { service, paths } = await createHarness();
    const result = await service.installSkill(paths, {
      skillName: "Global Helper",
      scope: "global",
      description: "Global helper instructions",
    });

    expect(result.scope).toBe("global");
    expect(result.agentId).toBeUndefined();
    expect(result.installedPath).toContain(
      `${path.sep}skills${path.sep}global-helper${path.sep}SKILL.md`,
    );

    const globalSkills = await service.listGlobalSkills(paths);
    expect(globalSkills.some((skill) => skill.id === "global-helper")).toBe(
      true,
    );
  });

  it("removes a global managed skill from central storage", async () => {
    const { service, paths, fileSystem } = await createHarness();
    await service.installSkill(paths, {
      skillName: "Global Helper",
      scope: "global",
      description: "Global helper instructions",
    });

    const result = await service.removeSkill(paths, {
      scope: "global",
      skillId: "global-helper",
    });

    expect(result.scope).toBe("global");
    expect(result.removedFromGlobal).toBe(true);
    expect(
      await fileSystem.exists(
        path.join(paths.skillsDir, "global-helper", "SKILL.md"),
      ),
    ).toBe(false);
  });

  it("removes an assigned skill from agent config and workspace directories", async () => {
    const { service, paths, fileSystem } = await createHarness();
    await service.installSkill(
      paths,
      {
        agentId: "ceo",
        skillName: "frontend-design",
        description: "Frontend design workflow",
      },
      {
        workspaceDir: path.join(paths.workspacesDir, "ceo"),
        workspaceSkillDirectories: [".agents/skills"],
      },
    );

    const result = await service.removeSkill(
      paths,
      {
        scope: "agent",
        agentId: "ceo",
        skillId: "frontend-design",
      },
      {
        workspaceDir: path.join(paths.workspacesDir, "ceo"),
        workspaceSkillDirectories: [".agents/skills"],
      },
    );

    expect(result.scope).toBe("agent");
    expect(result.agentId).toBe("ceo");
    expect(result.removedFromAgentIds).toEqual(["ceo"]);
    expect(result.removedWorkspacePaths).toEqual([
      path.join(
        paths.workspacesDir,
        "ceo",
        ".agents",
        "skills",
        "frontend-design",
        "SKILL.md",
      ),
    ]);
    const config = JSON.parse(
      await readFile(path.join(paths.agentsDir, "ceo", "config.json"), "utf8"),
    ) as {
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(config.runtime?.skills?.assigned).not.toContain("frontend-design");
    expect(
      await fileSystem.exists(
        path.join(
          paths.workspacesDir,
          "ceo",
          ".agents",
          "skills",
          "frontend-design",
        ),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(paths.skillsDir, "frontend-design", "SKILL.md"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(
          paths.skillsDir,
          ".agent-scoped",
          "ceo",
          "frontend-design",
          "SKILL.md",
        ),
      ),
    ).toBe(false);
  });

  it("reconciles role types without persisting role skills locally", async () => {
    const { service, paths } = await createHarness();

    await service.installSkill(paths, {
      agentId: "ceo",
      skillName: "og-board-manager",
      description: "Manager role skill",
    });

    const managerConfig = JSON.parse(
      await readFile(path.join(paths.agentsDir, "ceo", "config.json"), "utf8"),
    ) as {
      organization?: { type?: string };
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(managerConfig.organization?.type).toBe("manager");
    expect(managerConfig.runtime?.skills?.assigned).toEqual([]);

    await service.installSkill(paths, {
      agentId: "ceo",
      skillName: "og-board-individual",
      description: "Individual role skill",
    });

    const individualConfig = JSON.parse(
      await readFile(path.join(paths.agentsDir, "ceo", "config.json"), "utf8"),
    ) as {
      organization?: { type?: string };
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(individualConfig.organization?.type).toBe("individual");
    expect(individualConfig.runtime?.skills?.assigned).toEqual([]);
  });
});

async function createHarness(): Promise<{
  service: SkillService;
  paths: ReturnType<TestPathsProvider["getPaths"]>;
  fileSystem: NodeFileSystem;
}>;
async function createHarness(options: {
  commandRunner?: CommandRunnerPort;
}): Promise<{
  service: SkillService;
  paths: ReturnType<TestPathsProvider["getPaths"]>;
  fileSystem: NodeFileSystem;
}>;
async function createHarness(
  options: {
    commandRunner?: CommandRunnerPort;
  } = {},
): Promise<{
  service: SkillService;
  paths: ReturnType<TestPathsProvider["getPaths"]>;
  fileSystem: NodeFileSystem;
}> {
  const root = await createTempDir("opengoat-skill-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const pathsProvider = new TestPathsProvider(root);
  const paths = pathsProvider.getPaths();

  await fileSystem.ensureDir(paths.homeDir);
  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.skillsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.runsDir);

  await fileSystem.ensureDir(path.join(paths.workspacesDir, "ceo"));
  await fileSystem.ensureDir(path.join(paths.agentsDir, "ceo"));
  await writeFile(
    path.join(paths.agentsDir, "ceo", "config.json"),
    JSON.stringify(
      {
        schemaVersion: 2,
        id: "ceo",
        runtime: {
          skills: {
            enabled: true,
            includeManaged: true,
            assigned: [],
          },
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return {
    service: new SkillService({
      fileSystem,
      pathPort,
      commandRunner: options.commandRunner,
    }),
    paths,
    fileSystem,
  };
}

async function setAssignedSkills(
  fileSystem: NodeFileSystem,
  paths: ReturnType<TestPathsProvider["getPaths"]>,
  skills: string[],
): Promise<void> {
  const configPath = path.join(paths.agentsDir, "ceo", "config.json");
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as {
    runtime?: { skills?: { assigned?: string[] } };
  };
  config.runtime = config.runtime ?? {};
  config.runtime.skills = config.runtime.skills ?? {};
  config.runtime.skills.assigned = skills;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
