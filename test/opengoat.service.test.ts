import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OpenGoatService } from "../src/core/opengoat/index.js";
import { NodeFileSystem } from "../src/platform/node/node-file-system.js";
import { NodePathPort } from "../src/platform/node/node-path.port.js";
import { TestPathsProvider, createTempDir, removeTempDir } from "./helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("OpenGoatService", () => {
  it("exposes home path and performs end-to-end bootstrap", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root);

    expect(service.getHomeDir()).toBe(root);

    const result = await service.initialize();
    expect(result.defaultAgent).toBe("orchestrator");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
  });

  it("creates and lists agents through the facade", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root);
    await service.initialize();

    await service.createAgent("Research Analyst");

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual(["orchestrator", "research-analyst"]);

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
  });

  it("gets and sets provider binding for an agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root);
    await service.initialize();

    const before = await service.getAgentProvider("orchestrator");
    expect(before.providerId).toBe("codex");

    const after = await service.setAgentProvider("orchestrator", "claude");
    expect(after.providerId).toBe("claude");
  });
});

function createService(root: string): OpenGoatService {
  return new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });
}
