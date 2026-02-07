import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SkillService } from "../../src/core/skills/index.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
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
  it("merges managed + workspace skills with workspace precedence", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const managedPath = path.join(paths.skillsDir, "code-review");
    await fileSystem.ensureDir(managedPath);
    await fileSystem.writeFile(
      path.join(managedPath, "SKILL.md"),
      ["---", "name: Code Review", "description: Managed description", "---", "", "# Managed"].join("\n")
    );

    const workspacePath = path.join(paths.workspacesDir, "orchestrator", "skills", "code-review");
    await fileSystem.ensureDir(workspacePath);
    await fileSystem.writeFile(
      path.join(workspacePath, "SKILL.md"),
      ["---", "name: Code Review", "description: Workspace description", "---", "", "# Workspace"].join("\n")
    );

    const skills = await service.listSkills(paths, "orchestrator");
    expect(skills).toHaveLength(1);
    expect(skills[0]?.source).toBe("workspace");
    expect(skills[0]?.description).toContain("Workspace");
  });

  it("builds an agent skills prompt with skill entries", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const workspacePath = path.join(paths.workspacesDir, "orchestrator", "skills", "deploy-checklist");
    await fileSystem.ensureDir(workspacePath);
    await fileSystem.writeFile(
      path.join(workspacePath, "SKILL.md"),
      ["---", "name: Deploy Checklist", "description: Release process", "---", "", "# Deploy", "", "- Step A"].join(
        "\n"
      )
    );

    const prompt = await service.buildSkillsPrompt(paths, "orchestrator");
    expect(prompt.prompt).toContain("## Skills");
    expect(prompt.prompt).toContain("<available_skills>");
    expect(prompt.prompt).toContain("deploy-checklist");
    expect(prompt.prompt).toContain("Self-install/update");
  });

  it("loads plugin skills as part of merged skill context", async () => {
    const pluginSkillRoots: string[] = [];
    const { service, paths, fileSystem } = await createHarness({
      pluginSkillDirsProvider: async () => pluginSkillRoots
    });

    const pluginRoot = path.join(paths.homeDir, "openclaw-compat", "extensions", "demo-plugin", "skills");
    pluginSkillRoots.push(pluginRoot);
    const pluginSkillDir = path.join(pluginRoot, "release-audit");
    await fileSystem.ensureDir(pluginSkillDir);
    await fileSystem.writeFile(
      path.join(pluginSkillDir, "SKILL.md"),
      ["---", "name: Release Audit", "description: Plugin skill", "---", "", "# Audit"].join("\n")
    );

    const skills = await service.listSkills(paths, "orchestrator");
    expect(skills).toHaveLength(1);
    expect(skills[0]?.source).toBe("plugin");
    expect(skills[0]?.id).toBe("release-audit");
  });

  it("installs from source path and preserves extra files", async () => {
    const { service, paths, fileSystem } = await createHarness();
    const sourceSkillDir = path.join(paths.homeDir, "tmp-source-skill");
    await fileSystem.ensureDir(sourceSkillDir);
    await fileSystem.writeFile(
      path.join(sourceSkillDir, "SKILL.md"),
      ["---", "name: Local Skill", "description: Source path skill", "---", "", "# Local"].join("\n")
    );
    await fileSystem.writeFile(path.join(sourceSkillDir, "references.md"), "extra\n");

    const result = await service.installSkill(paths, {
      agentId: "orchestrator",
      skillName: "local-skill",
      sourcePath: sourceSkillDir
    });

    expect(result.source).toBe("source-path");
    expect(await readFile(result.installedPath, "utf8")).toContain("Local Skill");
    expect(await readFile(path.join(path.dirname(result.installedPath), "references.md"), "utf8")).toContain(
      "extra"
    );
  });

  it("generates a scaffold skill when no source exists", async () => {
    const { service, paths } = await createHarness();
    const result = await service.installSkill(paths, {
      skillName: "Release Notes",
      description: "Generate release notes"
    });

    const markdown = await readFile(result.installedPath, "utf8");
    expect(result.source).toBe("generated");
    expect(markdown).toContain("# Release Notes");
    expect(markdown).toContain("Generate release notes");
  });
});

async function createHarness(): Promise<{
  service: SkillService;
  paths: ReturnType<TestPathsProvider["getPaths"]>;
  fileSystem: NodeFileSystem;
}>;
async function createHarness(options: {
  pluginSkillDirsProvider?: (paths: ReturnType<TestPathsProvider["getPaths"]>) => Promise<string[]>;
} = {}): Promise<{
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

  await fileSystem.ensureDir(path.join(paths.workspacesDir, "orchestrator"));
  await fileSystem.ensureDir(path.join(paths.workspacesDir, "orchestrator", "skills"));
  await fileSystem.ensureDir(path.join(paths.agentsDir, "orchestrator"));
  await writeFile(
    path.join(paths.agentsDir, "orchestrator", "config.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "orchestrator",
        runtime: {
          skills: {
            enabled: true,
            includeWorkspace: true,
            includeManaged: true
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
      pathPort,
      pluginSkillDirsProvider: options.pluginSkillDirsProvider
    }),
    paths,
    fileSystem
  };
}
