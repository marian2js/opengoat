import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
  }),
  clear: vi.fn(() => {
    store.clear();
  }),
  get length() {
    return store.size;
  },
  key: vi.fn((_index: number) => null),
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("chat-scope persistence helpers", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  it("getChatScope returns unattached when no scope stored", async () => {
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    expect(mod.getChatScope("sess-1")).toEqual({ type: "unattached" });
  });

  it("writeChatScope persists and getChatScope retrieves it", async () => {
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    const scope = { type: "objective" as const, objectiveId: "obj-1" };
    mod.writeChatScope("sess-1", scope);
    expect(mod.getChatScope("sess-1")).toEqual(scope);
  });

  it("clearChatScope removes the session entry", async () => {
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    mod.writeChatScope("sess-1", { type: "project" });
    mod.clearChatScope("sess-1");
    expect(mod.getChatScope("sess-1")).toEqual({ type: "unattached" });
  });

  it("readChatScopes returns empty map on corrupt localStorage", async () => {
    store.set("opengoat:chatScopes", "not-json{{{");
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    expect(mod.readChatScopes()).toEqual({});
  });

  it("supports multiple sessions simultaneously", async () => {
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    mod.writeChatScope("sess-1", { type: "project" });
    mod.writeChatScope("sess-2", {
      type: "run",
      objectiveId: "obj-1",
      runId: "run-1",
    });
    expect(mod.getChatScope("sess-1")).toEqual({ type: "project" });
    expect(mod.getChatScope("sess-2")).toEqual({
      type: "run",
      objectiveId: "obj-1",
      runId: "run-1",
    });
  });

  it("getScopeLabel returns correct labels for each type", async () => {
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    expect(mod.getScopeLabel({ type: "unattached" })).toBe("Unattached");
    expect(mod.getScopeLabel({ type: "project" })).toBe("Project");
    expect(mod.getScopeLabel({ type: "objective", objectiveId: "x" })).toBe(
      "Objective",
    );
    expect(
      mod.getScopeLabel({ type: "run", objectiveId: "x", runId: "y" }),
    ).toBe("Run");
  });
});
