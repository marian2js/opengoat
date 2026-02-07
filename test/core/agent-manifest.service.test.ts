import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentManifestService } from "../../src/core/agents/index.js";
import type { OpenGoatPaths } from "../../src/core/domain/opengoat-paths.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
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
    await seedAgent(fileSystem, paths, "researcher", "openai");

    await fileSystem.writeFile(
      path.join(paths.workspacesDir, "researcher", "AGENTS.md"),
      [
        "---",
        "id: researcher",
        "name: Researcher",
        "description: Handles research tasks",
        "provider: openai",
        "tags: [research, docs]",
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
    expect(manifest.metadata.provider).toBe("openai");
    expect(manifest.metadata.tags).toEqual(["research", "docs"]);
    expect(manifest.metadata.priority).toBe(80);
    expect(manifest.source).toBe("frontmatter");
  });

  it("syncs provider in AGENTS.md front matter", async () => {
    const { service, fileSystem, paths } = await createHarness();
    await seedAgent(fileSystem, paths, "researcher", "openai");

    await fileSystem.writeFile(
      path.join(paths.workspacesDir, "researcher", "AGENTS.md"),
      [
        "---",
        "id: researcher",
        "name: Researcher",
        "description: Handles research tasks",
        "provider: openai",
        "tags: [research]",
        "delegation:",
        "  canReceive: true",
        "  canDelegate: false",
        "priority: 50",
        "---",
        "",
        "# Research Agent"
      ].join("\n") + "\n"
    );

    await service.syncManifestProvider(paths, "researcher", "openrouter");
    const updated = await readFile(path.join(paths.workspacesDir, "researcher", "AGENTS.md"), "utf8");

    expect(updated).toContain("provider: openrouter");
    expect(updated).toContain("# Research Agent");
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
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.providersDir);
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
  providerId: string
): Promise<void> {
  await fileSystem.ensureDir(path.join(paths.workspacesDir, agentId));
  await fileSystem.ensureDir(path.join(paths.agentsDir, agentId));
  await fileSystem.writeFile(
    path.join(paths.workspacesDir, agentId, "workspace.json"),
    JSON.stringify({ displayName: "Researcher" }, null, 2) + "\n"
  );
  await fileSystem.writeFile(
    path.join(paths.agentsDir, agentId, "config.json"),
    JSON.stringify(
      {
        provider: {
          id: providerId
        }
      },
      null,
      2
    ) + "\n"
  );
}
