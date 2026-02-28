import { lstat, readFile, readlink } from "node:fs/promises";
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
  it("initializes the full OpenGoat home and goat manager agent", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    const result = await service.initialize();

    expect(result.paths.homeDir).toBe(paths.homeDir);
    expect(result.defaultAgent).toBe("goat");
    expect(result.createdPaths.length).toBeGreaterThan(0);
    expect(await fileSystem.exists(paths.organizationDir)).toBe(true);
    const organizationTemplates = listOrganizationMarkdownTemplates();
    expect(organizationTemplates.length).toBeGreaterThan(0);
    for (const template of organizationTemplates) {
      expect(
        await fileSystem.exists(path.join(paths.organizationDir, template.fileName)),
      ).toBe(true);
    }
    expect(
      await fileSystem.exists(path.join(paths.organizationDir, "wiki", "index.md")),
    ).toBe(true);

    const config = JSON.parse(
      await readFile(paths.globalConfigJsonPath, "utf-8"),
    ) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("goat");

    const ceoConfig = JSON.parse(
      await readFile(path.join(paths.agentsDir, "goat", "config.json"), "utf-8"),
    ) as { runtime?: { provider?: { id?: string } } };
    expect(ceoConfig.runtime?.provider?.id).toBe("openclaw");
    const sageConfig = JSON.parse(
      await readFile(path.join(paths.agentsDir, "sage", "config.json"), "utf-8"),
    ) as {
      role?: string;
      organization?: { type?: string; reportsTo?: string | null };
      runtime?: { provider?: { id?: string } };
    };
    expect(sageConfig.role).toBe("Product Manager");
    expect(sageConfig.organization?.type).toBe("manager");
    expect(sageConfig.organization?.reportsTo).toBe("goat");
    expect(sageConfig.runtime?.provider?.id).toBe("openclaw");

    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "goat", "AGENTS.md"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(path.join(paths.workspacesDir, "goat", "ROLE.md")),
    ).toBe(true);
    expect(
      await fileSystem.exists(path.join(paths.workspacesDir, "sage", "ROLE.md")),
    ).toBe(true);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "goat", "reportees"),
      ),
    ).toBe(true);
    const ceoOrganizationLinkPath = path.join(
      paths.workspacesDir,
      "goat",
      "organization",
    );
    expect((await lstat(ceoOrganizationLinkPath)).isSymbolicLink()).toBe(true);
    expect(
      path.resolve(
        path.dirname(ceoOrganizationLinkPath),
        await readlink(ceoOrganizationLinkPath),
      ),
    ).toBe(path.resolve(paths.organizationDir));
    expect(
      await fileSystem.exists(path.join(paths.workspacesDir, "goat", "SOUL.md")),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "goat", "skills", "manager", "SKILL.md"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(
          paths.workspacesDir,
          "goat",
          "skills",
          "og-board-manager",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "goat", "skills", "og-board-individual"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "goat", "skills", "og-boards"),
      ),
    ).toBe(false);
    expect(
      await fileSystem.exists(
        path.join(paths.workspacesDir, "goat", "BOOTSTRAP.md"),
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

  it("does not recreate goat BOOTSTRAP.md after initial creation", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    await service.initialize();
    const bootstrapPath = path.join(paths.workspacesDir, "goat", "BOOTSTRAP.md");
    expect(await fileSystem.exists(bootstrapPath)).toBe(true);

    await fileSystem.removeDir(bootstrapPath);
    expect(await fileSystem.exists(bootstrapPath)).toBe(false);

    await service.initialize();

    expect(await fileSystem.exists(bootstrapPath)).toBe(false);
  });

  it("does not recreate goat BOOTSTRAP.md when repairing goat on an existing home", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    await service.initialize();
    const bootstrapPath = path.join(paths.workspacesDir, "goat", "BOOTSTRAP.md");
    const ceoConfigDir = path.join(paths.agentsDir, "goat");
    expect(await fileSystem.exists(bootstrapPath)).toBe(true);
    expect(await fileSystem.exists(ceoConfigDir)).toBe(true);

    await fileSystem.removeDir(bootstrapPath);
    await fileSystem.removeDir(ceoConfigDir);
    expect(await fileSystem.exists(bootstrapPath)).toBe(false);
    expect(await fileSystem.exists(ceoConfigDir)).toBe(false);

    await service.initialize();

    expect(await fileSystem.exists(ceoConfigDir)).toBe(true);
    expect(await fileSystem.exists(bootstrapPath)).toBe(false);
  });

  it("preserves configured defaultAgent when config was changed", async () => {
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

    const result = await service.initialize();

    const config = JSON.parse(
      await readFile(paths.globalConfigJsonPath, "utf-8"),
    ) as {
      defaultAgent: string;
    };

    expect(config.defaultAgent).toBe("custom-agent");
    expect(result.defaultAgent).toBe("custom-agent");
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
    expect(config.defaultAgent).toBe("goat");
  });

  it("ensures agents index always includes goat and sage", async () => {
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
    expect(index.agents).toEqual(["goat", "research", "sage"]);
  });

  it("repairs pre-existing Sage config to manager reporting to Goat", async () => {
    const { service, paths, fileSystem } = await createBootstrapService();

    await fileSystem.ensureDir(path.join(paths.agentsDir, "sage"));
    await fileSystem.writeFile(
      path.join(paths.agentsDir, "sage", "config.json"),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          id: "sage",
          displayName: "Sage",
          role: "",
          organization: {
            type: "individual",
            reportsTo: "goat",
          },
          runtime: {
            provider: {
              id: "openclaw",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    await service.initialize();

    const sageConfig = JSON.parse(
      await readFile(path.join(paths.agentsDir, "sage", "config.json"), "utf-8"),
    ) as {
      role?: string;
      organization?: { type?: string; reportsTo?: string | null };
    };
    expect(sageConfig.role).toBe("Product Manager");
    expect(sageConfig.organization?.type).toBe("manager");
    expect(sageConfig.organization?.reportsTo).toBe("goat");
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
