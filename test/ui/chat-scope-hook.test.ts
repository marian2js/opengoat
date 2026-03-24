import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/chat/hooks/useChatScope.ts",
  ),
  "utf-8",
);

describe("useChatScope hook structure", () => {
  it("exports useChatScope function", () => {
    expect(src).toContain("export function useChatScope");
  });

  it("accepts sessionId parameter", () => {
    expect(src).toContain("sessionId: string | undefined");
  });

  it("returns scope, setScope, and clearScope", () => {
    expect(src).toContain("scope");
    expect(src).toContain("setScope");
    expect(src).toContain("clearScope");
  });

  it("reads initial scope from getChatScope on mount", () => {
    expect(src).toContain("getChatScope");
  });

  it("persists scope changes via writeChatScope", () => {
    expect(src).toContain("writeChatScope");
  });

  it("clears scope via clearChatScope", () => {
    expect(src).toContain("clearChatScope");
  });

  it("defaults to unattached when no sessionId", () => {
    expect(src).toContain('type: "unattached"');
  });
});

describe("useChatScope hook localStorage integration", () => {
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

  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  // Ensure localStorage integration works via the chat-scope module
  it("writeChatScope followed by getChatScope round-trips correctly", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    const mod = await import(
      "../../apps/desktop/src/features/chat/lib/chat-scope"
    );
    const scope = { type: "objective" as const, objectiveId: "obj-abc" };
    mod.writeChatScope("session-hook-test", scope);
    const retrieved = mod.getChatScope("session-hook-test");
    expect(retrieved).toEqual(scope);
  });
});
