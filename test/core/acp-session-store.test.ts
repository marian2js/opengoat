import { describe, expect, it } from "vitest";
import { InMemoryAcpSessionStore } from "../../src/core/acp/index.js";

describe("InMemoryAcpSessionStore", () => {
  it("stores sessions, updates entries, and tracks active runs", () => {
    const store = new InMemoryAcpSessionStore();

    store.put({
      sessionId: "s1",
      agentId: "orchestrator",
      sessionRef: "main",
      cwd: "/tmp",
      createdAt: 1,
      updatedAt: 1
    });

    expect(store.get("s1")?.agentId).toBe("orchestrator");

    store.update("s1", {
      agentId: "developer",
      updatedAt: 2
    });
    expect(store.get("s1")?.agentId).toBe("developer");

    store.setActiveRun("s1", {
      runId: "r1",
      sessionId: "s1",
      cancelled: false
    });
    expect(store.getActiveRun("s1")?.runId).toBe("r1");

    store.clearActiveRun("s1");
    expect(store.getActiveRun("s1")).toBeUndefined();

    expect(store.list()).toHaveLength(1);
    store.clear();
    expect(store.list()).toHaveLength(0);
  });
});
