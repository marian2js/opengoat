import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillService } from "../../packages/core/src/core/skills/index.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { TestPathsProvider, createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

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
      ["---", "name: Code Review", "description: Managed description", "---", "", "# Managed"].join("\n")
    );

    await setAssignedSkills(fileSystem, paths, ["code-review"]);

    const skills = await service.listSkills(paths, "goat");
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
      ["---", "name: Deploy Checklist", "description: Release process", "---", "", "# Deploy", "", "- Step A"].join(
        "\n"
      )
    );
    await setAssignedSkills(fileSystem, paths, ["deploy-checklist"]);

    const prompt = await service.buildSkillsPrompt(paths, "goat");
    expect(prompt.prompt).toContain("## Skills");
    expect(prompt.prompt).toContain("<available_skills>");
    expect(prompt.prompt).toContain("deploy-checklist");
    expect(prompt.prompt).toContain("global skills store");
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
        "# Hidden"
      ].join("\n")
    );
    await setAssignedSkills(fileSystem, paths, ["hidden-skill"]);

    const allSkills = await service.listSkills(paths, "goat");
    expect(allSkills.some((skill) => skill.id === "hidden-skill")).toBe(true);

    const prompt = await service.buildSkillsPrompt(paths, "goat");
    expect(prompt.prompt).not.toContain("hidden-skill");
  });

  it("loads extra-dir skills when assigned", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const extraSkillsRoot = path.join(paths.homeDir, "extra-skills");

    const extraSkillDir = path.join(extraSkillsRoot, "release-audit");
    await fileSystem.ensureDir(extraSkillDir);
    await fileSystem.writeFile(
      path.join(extraSkillDir, "SKILL.md"),
      ["---", "name: Release Audit", "description: Extra-dir skill", "---", "", "# Audit"].join("\n")
    );
    await setAssignedSkills(fileSystem, paths, ["release-audit"]);
    await writeFile(
      path.join(paths.agentsDir, "goat", "config.json"),
      JSON.stringify(
        {
          schemaVersion: 2,
          id: "goat",
          runtime: {
            skills: {
              enabled: true,
              includeManaged: true,
              assigned: ["release-audit"],
              load: {
                extraDirs: [extraSkillsRoot]
              }
            }
          }
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const skills = await service.listSkills(paths, "goat");
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
      ["---", "name: Local Skill", "description: Source path skill", "---", "", "# Local"].join("\n")
    );
    await fileSystem.writeFile(path.join(sourceSkillDir, "references.md"), "extra\n");

    const result = await service.installSkill(paths, {
      agentId: "goat",
      skillName: "local-skill",
      sourcePath: sourceSkillDir
    });

    expect(result.source).toBe("source-path");
    expect(await readFile(result.installedPath, "utf8")).toContain("Local Skill");
    expect(await readFile(path.join(path.dirname(result.installedPath), "references.md"), "utf8")).toContain("extra");

    const config = JSON.parse(await readFile(path.join(paths.agentsDir, "goat", "config.json"), "utf8")) as {
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(config.runtime?.skills?.assigned).toContain("local-skill");
  });

  it("installs and lists global managed skills", async () => {
    const { service, paths } = await createHarness();
    const result = await service.installSkill(paths, {
      skillName: "Global Helper",
      scope: "global",
      description: "Global helper instructions"
    });

    expect(result.scope).toBe("global");
    expect(result.agentId).toBeUndefined();
    expect(result.installedPath).toContain(`${path.sep}skills${path.sep}global-helper${path.sep}SKILL.md`);

    const globalSkills = await service.listGlobalSkills(paths);
    expect(globalSkills.some((skill) => skill.id === "global-helper")).toBe(true);
  });

  it("reconciles role skills when switching between manager and individual skills", async () => {
    const { service, paths } = await createHarness();

    await service.installSkill(paths, {
      agentId: "goat",
      skillName: "manager",
      description: "Manager role skill"
    });

    const managerConfig = JSON.parse(await readFile(path.join(paths.agentsDir, "goat", "config.json"), "utf8")) as {
      organization?: { type?: string };
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(managerConfig.organization?.type).toBe("manager");
    expect(managerConfig.runtime?.skills?.assigned).toEqual(["manager", "board-manager"]);

    await service.installSkill(paths, {
      agentId: "goat",
      skillName: "board-individual",
      description: "Individual role skill"
    });

    const individualConfig = JSON.parse(await readFile(path.join(paths.agentsDir, "goat", "config.json"), "utf8")) as {
      organization?: { type?: string };
      runtime?: { skills?: { assigned?: string[] } };
    };
    expect(individualConfig.organization?.type).toBe("individual");
    expect(individualConfig.runtime?.skills?.assigned).toEqual(["board-individual"]);
  });
});

async function createHarness(): Promise<{
  service: SkillService;
  paths: ReturnType<TestPathsProvider["getPaths"]>;
  fileSystem: NodeFileSystem;
}>;
async function createHarness(): Promise<{
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

  await fileSystem.ensureDir(path.join(paths.workspacesDir, "goat"));
  await fileSystem.ensureDir(path.join(paths.agentsDir, "goat"));
  await writeFile(
    path.join(paths.agentsDir, "goat", "config.json"),
    JSON.stringify(
      {
        schemaVersion: 2,
        id: "goat",
        runtime: {
          skills: {
            enabled: true,
            includeManaged: true,
            assigned: []
          }
        }
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  return {
    service: new SkillService({
      fileSystem,
      pathPort
    }),
    paths,
    fileSystem
  };
}

async function setAssignedSkills(fileSystem: NodeFileSystem, paths: ReturnType<TestPathsProvider["getPaths"]>, skills: string[]): Promise<void> {
  const configPath = path.join(paths.agentsDir, "goat", "config.json");
  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as { runtime?: { skills?: { assigned?: string[] } } };
  config.runtime = config.runtime ?? {};
  config.runtime.skills = config.runtime.skills ?? {};
  config.runtime.skills.assigned = skills;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
