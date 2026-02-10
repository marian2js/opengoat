import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentManifestService } from "../../packages/core/src/core/agents/index.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("AgentManifestService", () => {
  it("parses AGENTS.md front matter metadata", async () => {
    const { service, fileSystem, paths } = await createHarness();
    await seedAgent(fileSystem, paths, "researcher", "Researcher");

    await fileSystem.writeFile(
      path.join(paths.workspacesDir, "researcher", "AGENTS.md"),
      [
        "---",
        "id: researcher",
        "name: Researcher",
        "description: Handles research tasks",
        "type: specialist",
        "reportsTo: goat",
        "discoverable: false",
        "tags: [research, docs]",
        "skills: [research, citations]",
        "delegation:",
        "  canReceive: true",
        "  canDelegate: false",
        "priority: 80",
        "---",
        "",
        "# Research Agent",
        "Use citations."
      ].join("\n") + "\n"
    );

    const manifest = await service.getManifest(paths, "researcher");

    expect(manifest.metadata.name).toBe("Researcher");
    expect(manifest.metadata.type).toBe("individual");
    expect(manifest.metadata.reportsTo).toBe("goat");
    expect(manifest.metadata.discoverable).toBe(false);
    expect(manifest.metadata.tags).toEqual(["research", "docs"]);
    expect(manifest.metadata.skills).toEqual(["research", "citations"]);
    expect(manifest.metadata.priority).toBe(80);
    expect(manifest.source).toBe("frontmatter");
  });

  it("derives defaults when AGENTS.md is missing", async () => {
    const { service, fileSystem, paths } = await createHarness();
    await seedAgent(fileSystem, paths, "developer", "Developer");

    const manifest = await service.getManifest(paths, "developer");
    expect(manifest.source).toBe("derived");
    expect(manifest.metadata.type).toBe("individual");
    expect(manifest.metadata.reportsTo).toBe("goat");
    expect(manifest.metadata.skills).toEqual([]);
  });
});

async function createHarness(): Promise<{
  service: AgentManifestService;
  fileSystem: NodeFileSystem;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-manifest-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.sessionsDir);
  await fileSystem.ensureDir(paths.runsDir);

  return {
    service: new AgentManifestService({
      fileSystem,
      pathPort: new NodePathPort()
    }),
    fileSystem,
    paths
  };
}

async function seedAgent(
  fileSystem: NodeFileSystem,
  paths: OpenGoatPaths,
  agentId: string,
  displayName: string
): Promise<void> {
  await fileSystem.ensureDir(path.join(paths.workspacesDir, agentId));
  await fileSystem.ensureDir(path.join(paths.agentsDir, agentId));
  await fileSystem.writeFile(
    path.join(paths.workspacesDir, agentId, "workspace.json"),
    JSON.stringify({ displayName }, null, 2) + "\n"
  );
}
