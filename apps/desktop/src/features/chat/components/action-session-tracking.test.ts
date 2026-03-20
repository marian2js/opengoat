import { describe, expect, it, beforeEach, vi } from "vitest";

// We need to test the exported helpers. Since they rely on localStorage at module
// scope, we set up a mock localStorage before importing.
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

describe("action session tracking", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  it("markActionSession persists to localStorage and isActionSession retrieves it", async () => {
    const mod = await import("./ChatWorkspace");
    mod.markActionSession("session-1");
    expect(mod.isActionSession("session-1")).toBe(true);
    expect(mod.isActionSession("session-unknown")).toBe(false);

    // Verify localStorage was written
    const stored = store.get("opengoat:actionSessions");
    expect(stored).toBeDefined();
    const ids = JSON.parse(stored!);
    expect(ids).toContain("session-1");
  });

  it("isActionSession returns false for non-action sessions", async () => {
    const mod = await import("./ChatWorkspace");
    expect(mod.isActionSession("regular-session")).toBe(false);
  });

  it("markActionSession can track multiple sessions", async () => {
    const mod = await import("./ChatWorkspace");
    mod.markActionSession("session-a");
    mod.markActionSession("session-b");
    expect(mod.isActionSession("session-a")).toBe(true);
    expect(mod.isActionSession("session-b")).toBe(true);
    expect(mod.isActionSession("session-c")).toBe(false);
  });
});
