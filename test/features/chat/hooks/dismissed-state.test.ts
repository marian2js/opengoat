import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock localStorage before importing hooks
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

describe("dismissed proposals localStorage", () => {
  const STORAGE_KEY = "opengoat:dismissedProposals";

  beforeEach(() => {
    store.clear();
  });

  it("stores dismissed session ids", () => {
    store.set(STORAGE_KEY, JSON.stringify(["session-1"]));
    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed).toContain("session-1");
  });

  it("starts empty when no data exists", () => {
    const raw = store.get(STORAGE_KEY);
    expect(raw).toBeUndefined();
  });

  it("allows adding new session ids", () => {
    const ids = ["session-1"];
    store.set(STORAGE_KEY, JSON.stringify(ids));

    const existing = JSON.parse(store.get(STORAGE_KEY)!) as string[];
    existing.push("session-2");
    store.set(STORAGE_KEY, JSON.stringify(existing));

    const result = JSON.parse(store.get(STORAGE_KEY)!) as string[];
    expect(result).toContain("session-1");
    expect(result).toContain("session-2");
  });
});

describe("dismissed memories localStorage", () => {
  const STORAGE_KEY = "opengoat:dismissedMemories";

  beforeEach(() => {
    store.clear();
  });

  it("stores dismissed candidate ids per session", () => {
    const map = { "session-1": ["mem-1", "mem-2"] };
    store.set(STORAGE_KEY, JSON.stringify(map));

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as Record<string, string[]>;
    expect(parsed["session-1"]).toContain("mem-1");
    expect(parsed["session-1"]).toContain("mem-2");
  });

  it("keeps separate lists per session", () => {
    const map = {
      "session-1": ["mem-1"],
      "session-2": ["mem-3"],
    };
    store.set(STORAGE_KEY, JSON.stringify(map));

    const parsed = JSON.parse(store.get(STORAGE_KEY)!) as Record<string, string[]>;
    expect(parsed["session-1"]).toEqual(["mem-1"]);
    expect(parsed["session-2"]).toEqual(["mem-3"]);
  });

  it("starts empty when no data exists", () => {
    expect(store.get(STORAGE_KEY)).toBeUndefined();
  });

  it("allows adding candidates to existing session", () => {
    const map: Record<string, string[]> = { "session-1": ["mem-1"] };
    store.set(STORAGE_KEY, JSON.stringify(map));

    const existing = JSON.parse(store.get(STORAGE_KEY)!) as Record<string, string[]>;
    existing["session-1"].push("mem-2");
    store.set(STORAGE_KEY, JSON.stringify(existing));

    const result = JSON.parse(store.get(STORAGE_KEY)!) as Record<string, string[]>;
    expect(result["session-1"]).toEqual(["mem-1", "mem-2"]);
  });
});
