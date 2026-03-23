import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SignalService } from "../../packages/core/src/core/signals/index.js";
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

describe("SignalService", () => {
  it("creates a signal with all fields and generates UUID + timestamps", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Competitor launched new feature",
      summary: "Acme Inc released a pricing page redesign",
      evidence: "https://acme.com/pricing",
      importance: "high",
      freshness: "fresh",
    });

    expect(signal.signalId).toBeTruthy();
    expect(signal.projectId).toBe("proj-1");
    expect(signal.sourceType).toBe("web");
    expect(signal.signalType).toBe("competitor-change");
    expect(signal.title).toBe("Competitor launched new feature");
    expect(signal.summary).toBe("Acme Inc released a pricing page redesign");
    expect(signal.evidence).toBe("https://acme.com/pricing");
    expect(signal.importance).toBe("high");
    expect(signal.freshness).toBe("fresh");
    expect(signal.status).toBe("new");
    expect(signal.objectiveId).toBeUndefined();
    expect(signal.createdAt).toBe("2026-03-20T10:00:00.000Z");
    expect(signal.updatedAt).toBeUndefined();
  });

  it("creates a signal with optional objectiveId", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "workspace",
      signalType: "stale-run-warning",
      title: "Run stale",
      summary: "Run xyz has been running for 48h",
      importance: "medium",
      freshness: "fresh",
      objectiveId: "obj-123",
    });

    expect(signal.objectiveId).toBe("obj-123");
  });

  it("retrieves a signal by ID", async () => {
    const harness = await createHarness();

    const created = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "seo",
      signalType: "seo-visibility-opportunity",
      title: "SEO opportunity",
      summary: "Keyword gap detected",
      importance: "medium",
      freshness: "recent",
    });

    const fetched = await harness.signalService.getSignal(
      harness.paths,
      created.signalId,
    );

    expect(fetched.signalId).toBe(created.signalId);
    expect(fetched.title).toBe("SEO opportunity");
  });

  it("throws on get non-existent signal", async () => {
    const harness = await createHarness();

    await expect(
      harness.signalService.getSignal(harness.paths, "non-existent-id"),
    ).rejects.toThrow("Signal not found");
  });

  it("lists signals filtered by projectId", async () => {
    const harness = await createHarness();

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Signal A",
      summary: "Summary A",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-2",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Signal B",
      summary: "Summary B",
      importance: "low",
      freshness: "fresh",
    });

    const result = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Signal A");
    expect(result.total).toBe(1);
  });

  it("lists signals filtered by objectiveId", async () => {
    const harness = await createHarness();

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Obj signal",
      summary: "Linked",
      importance: "low",
      freshness: "fresh",
      objectiveId: "obj-1",
    });

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "No obj",
      summary: "Not linked",
      importance: "low",
      freshness: "fresh",
    });

    const result = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      objectiveId: "obj-1",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Obj signal");
  });

  it("lists signals filtered by status", async () => {
    const harness = await createHarness();

    const s1 = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "New signal",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Another new",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.dismissSignal(harness.paths, s1.signalId);

    const result = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      status: "new",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Another new");
  });

  it("lists signals filtered by sourceType", async () => {
    const harness = await createHarness();

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Web signal",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "seo",
      signalType: "seo-visibility-opportunity",
      title: "SEO signal",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    const result = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      sourceType: "seo",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("SEO signal");
  });

  it("supports pagination with limit and offset", async () => {
    const harness = await createHarness();

    for (let i = 0; i < 5; i++) {
      await harness.signalService.createSignal(harness.paths, {
        projectId: "proj-1",
        sourceType: "web",
        signalType: "competitor-change",
        title: `Signal ${i}`,
        summary: "s",
        importance: "low",
        freshness: "fresh",
      });
    }

    const page1 = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      limit: 2,
      offset: 0,
    });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.limit).toBe(2);
    expect(page1.offset).toBe(0);

    const page2 = await harness.signalService.listSignals(harness.paths, {
      projectId: "proj-1",
      limit: 2,
      offset: 2,
    });

    expect(page2.items).toHaveLength(2);
    expect(page2.total).toBe(5);
    expect(page2.offset).toBe(2);
  });

  it("updates signal status with valid transitions", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-20T10:00:00.000Z",
    });

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Status test",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    expect(signal.status).toBe("new");

    const seen = await harness.signalService.updateSignalStatus(
      harness.paths,
      signal.signalId,
      "seen",
    );
    expect(seen.status).toBe("seen");
    expect(seen.updatedAt).toBe("2026-03-20T10:00:00.000Z");

    const saved = await harness.signalService.updateSignalStatus(
      harness.paths,
      seen.signalId,
      "saved",
    );
    expect(saved.status).toBe("saved");
  });

  it("rejects invalid status transitions", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Invalid transition test",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.dismissSignal(harness.paths, signal.signalId);

    await expect(
      harness.signalService.updateSignalStatus(
        harness.paths,
        signal.signalId,
        "new",
      ),
    ).rejects.toThrow("Invalid status transition");
  });

  it("promotes a signal", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Promote me",
      summary: "s",
      importance: "high",
      freshness: "fresh",
    });

    const promoted = await harness.signalService.promoteSignal(
      harness.paths,
      signal.signalId,
    );

    expect(promoted.status).toBe("promoted");
  });

  it("promotes a signal with targetObjectiveId", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Promote with obj",
      summary: "s",
      importance: "high",
      freshness: "fresh",
    });

    const promoted = await harness.signalService.promoteSignal(
      harness.paths,
      signal.signalId,
      "obj-999",
    );

    expect(promoted.status).toBe("promoted");
    expect(promoted.objectiveId).toBe("obj-999");
  });

  it("dismisses a signal", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Dismiss me",
      summary: "s",
      importance: "low",
      freshness: "stale",
    });

    const dismissed = await harness.signalService.dismissSignal(
      harness.paths,
      signal.signalId,
    );

    expect(dismissed.status).toBe("dismissed");
  });

  it("attaches a signal to an objective", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Attach test",
      summary: "s",
      importance: "medium",
      freshness: "recent",
    });

    expect(signal.objectiveId).toBeUndefined();

    const attached = await harness.signalService.attachToObjective(
      harness.paths,
      signal.signalId,
      "obj-42",
    );

    expect(attached.objectiveId).toBe("obj-42");
  });

  it("rejects update on non-existent signal", async () => {
    const harness = await createHarness();

    await expect(
      harness.signalService.updateSignalStatus(
        harness.paths,
        "non-existent",
        "seen",
      ),
    ).rejects.toThrow("Signal not found");
  });

  it("rejects promote on already promoted signal", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Already promoted",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.promoteSignal(harness.paths, signal.signalId);

    await expect(
      harness.signalService.promoteSignal(harness.paths, signal.signalId),
    ).rejects.toThrow("Invalid status transition");
  });

  it("rejects dismiss on already dismissed signal", async () => {
    const harness = await createHarness();

    const signal = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "competitor-change",
      title: "Already dismissed",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });

    await harness.signalService.dismissSignal(harness.paths, signal.signalId);

    await expect(
      harness.signalService.dismissSignal(harness.paths, signal.signalId),
    ).rejects.toThrow("Invalid status transition");
  });

  it("validates all status transition paths", async () => {
    const harness = await createHarness();

    // new → seen
    const s1 = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "t",
      title: "t1",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });
    const seen = await harness.signalService.updateSignalStatus(harness.paths, s1.signalId, "seen");
    expect(seen.status).toBe("seen");

    // new → saved
    const s2 = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "t",
      title: "t2",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });
    const saved = await harness.signalService.updateSignalStatus(harness.paths, s2.signalId, "saved");
    expect(saved.status).toBe("saved");

    // new → promoted
    const s3 = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "t",
      title: "t3",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });
    const promoted = await harness.signalService.updateSignalStatus(harness.paths, s3.signalId, "promoted");
    expect(promoted.status).toBe("promoted");

    // new → dismissed
    const s4 = await harness.signalService.createSignal(harness.paths, {
      projectId: "proj-1",
      sourceType: "web",
      signalType: "t",
      title: "t4",
      summary: "s",
      importance: "low",
      freshness: "fresh",
    });
    const dismissed = await harness.signalService.updateSignalStatus(harness.paths, s4.signalId, "dismissed");
    expect(dismissed.status).toBe("dismissed");

    // seen → saved
    const savedFromSeen = await harness.signalService.updateSignalStatus(harness.paths, seen.signalId, "saved");
    expect(savedFromSeen.status).toBe("saved");

    // saved → promoted
    const promotedFromSaved = await harness.signalService.updateSignalStatus(harness.paths, savedFromSeen.signalId, "promoted");
    expect(promotedFromSaved.status).toBe("promoted");
  });
});

async function createHarness(options?: {
  nowIso?: () => string;
}): Promise<{
  signalService: SignalService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-signal-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const paths: OpenGoatPaths = {
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

  await fileSystem.ensureDir(paths.homeDir);

  const signalService = new SignalService({
    fileSystem,
    pathPort,
    nowIso: options?.nowIso ?? (() => new Date().toISOString()),
  });

  return {
    signalService,
    paths,
  };
}
