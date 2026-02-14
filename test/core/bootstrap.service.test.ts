import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentService } from "../../packages/core/src/core/agents/index.js";
import { BootstrapService } from "../../packages/core/src/core/bootstrap/index.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { listOrganizationMarkdownTemplates } from "../../packages/core/src/core/templates/default-templates.js";
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

describe("BootstrapService", () => {
  it("initializes the full OpenGoat home and ceo manager agent", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    const result = await service.initialize();

    expect(result.paths.homeDir).toBe(paths.homeDir);
    expect(result.defaultAgent).toBe("ceo");
    expect(result.createdPaths.length).toBeGreaterThan(0);
    expect(await fileSystem.exists(paths.organizationDir)).toBe(true);
    const organizationTemplates = listOrganizationMarkdownTemplates();
    expect(organizationTemplates.length).toBeGreaterThan(0);
    for (const template of organizationTemplates) {
      expect(
        await fileSystem.exists(path.join(paths.organizationDir, template.fileName)),
      ).toBe(true);
    }

    const config = JSON.parse(
      await readFile(paths.globalConfigJsonPath, "utf-8"),
    ) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");

    const ceoConfig = JSON.parse(
      await readFile(path.join(paths.agentsDir, "ceo", "config.json"), "utf-8"),
    ) as { runtime?: { adapter?: string } };
    expect(ceoConfig.runtime?.adapter).toBe("openclaw");

    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "ceo", "AGENTS.md"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(path.join(paths.workspacesDir, "ceo", "ROLE.md")),
    ).toBe(true);
    expect(
      await fileSystem.exists(path.join(paths.workspacesDir, "ceo", "SOUL.md")),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "ceo", "skills", "manager", "SKILL.md"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(
          paths.workspacesDir,
          "ceo",
          "skills",
          "og-board-manager",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "ceo", "skills", "og-board-individual"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "ceo", "BOOTSTRAP.md"),
      ),
    ).toBe(true);
    expect(await fileSystem.exists(paths.skillsDir)).toBe(false);
  });

  it("is idempotent on repeated initialize", async () => {
    const { service } = await createBootstrapService();

    const first = await service.initialize();
    const second = await service.initialize();

    expect(first.createdPaths.length).toBeGreaterThan(0);
    expect(second.createdPaths).toEqual([]);
    expect(second.skippedPaths.length).toBeGreaterThan(0);
  });

  it("forces ceo as default even when config was changed", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    await fileSystem.ensureDir(paths.homeDir);
    await fileSystem.ensureDir(paths.workspacesDir);
    await fileSystem.ensureDir(paths.agentsDir);
    await fileSystem.writeFile(
      paths.globalConfigJsonPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          defaultAgent: "custom-agent",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        null,
        2,
      ) + "\n",
    );

    await service.initialize();

    const config = JSON.parse(
      await readFile(paths.globalConfigJsonPath, "utf-8"),
    ) as {
      defaultAgent: string;
    };

    expect(config.defaultAgent).toBe("ceo");
  });

  it("repairs config when it is malformed", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    await fileSystem.ensureDir(paths.homeDir);
    await fileSystem.ensureDir(paths.workspacesDir);
    await fileSystem.ensureDir(paths.agentsDir);
    await fileSystem.writeFile(paths.globalConfigJsonPath, "{not json");

    await service.initialize();

    const config = JSON.parse(
      await readFile(paths.globalConfigJsonPath, "utf-8"),
    ) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");
  });

  it("ensures agents index always includes ceo", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    await fileSystem.ensureDir(paths.homeDir);
    await fileSystem.ensureDir(paths.workspacesDir);
    await fileSystem.ensureDir(paths.agentsDir);
    await fileSystem.writeFile(
      paths.agentsIndexJsonPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          agents: ["research"],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        null,
        2,
      ) + "\n",
    );

    await service.initialize();

    const index = JSON.parse(
      await readFile(paths.agentsIndexJsonPath, "utf-8"),
    ) as {
      agents: string[];
    };
    expect(index.agents).toEqual(["ceo", "research"]);
  });
});

async function createBootstrapService(): Promise<{
  service: BootstrapService;
  paths: OpenGoatPaths;
  fileSystem: NodeFileSystem;
}> {
  const root = await createTempDir("opengoat-bootstrap-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const pathsProvider = new TestPathsProvider(root);
  const pathPort = new NodePathPort();
  const nowIso = () => "2026-02-06T00:00:00.000Z";

  const agentService = new AgentService({ fileSystem, pathPort, nowIso });
  const service = new BootstrapService({
    fileSystem,
    pathPort,
    pathsProvider,
    agentService,
    nowIso,
  });

  return {
    service,
    paths: pathsProvider.getPaths(),
    fileSystem,
  };
}
