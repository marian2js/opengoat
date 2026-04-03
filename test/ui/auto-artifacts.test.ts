import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Mock localStorage for Node environment ──
beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
});

// ── Helpers ──

const hookPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/chat/hooks/useAutoArtifacts.ts",
);

const readHook = () => readFileSync(hookPath, "utf-8");

// ═══════════════════════════════════════════════════════════
// 1. inferArtifactType — pure function tests
// ═══════════════════════════════════════════════════════════

// Import the pure functions directly
import {
  inferArtifactType,
  isStructuredContent,
  deriveArtifactTitle,
  getPersistedMessageIds,
  markMessagesPersisted,
  clearPersistedMessages,
} from "../../apps/desktop/src/features/chat/hooks/useAutoArtifacts";

describe("inferArtifactType", () => {
  it("detects launch_pack from launch-related content", () => {
    expect(inferArtifactType("Product Hunt Launch Pack\n- Tagline options\n- Description")).toBe(
      "launch_pack",
    );
  });

  it("detects email_sequence from outreach content", () => {
    expect(inferArtifactType("Cold Email Sequence\nSubject: Quick question\nHi {{name}},")).toBe(
      "email_sequence",
    );
  });

  it("detects checklist from checkbox content", () => {
    expect(inferArtifactType("Onboarding Checklist\n- [x] Set up landing page\n- [ ] Write copy")).toBe(
      "checklist",
    );
  });

  it("detects matrix from competitor-related content", () => {
    expect(inferArtifactType("Competitor Messaging Matrix\n| Feature | Us | Them |")).toBe(
      "matrix",
    );
  });

  it("detects research_brief from market research content", () => {
    expect(inferArtifactType("Market Research Brief\nKey findings from community analysis")).toBe(
      "research_brief",
    );
  });

  it("detects page_outline from page-related content", () => {
    expect(inferArtifactType("Homepage Hero Rewrite\nVariant A: ...")).toBe(
      "page_outline",
    );
  });

  it("detects copy_draft from SEO content", () => {
    expect(inferArtifactType("SEO Content Brief\nTarget keywords: ...")).toBe(
      "copy_draft",
    );
  });

  it("defaults to strategy_note for general content", () => {
    expect(inferArtifactType("Here are some ideas for improving your marketing presence.")).toBe(
      "strategy_note",
    );
  });
});

// ═══════════════════════════════════════════════════════════
// 2. isStructuredContent — content filtering
// ═══════════════════════════════════════════════════════════

describe("isStructuredContent", () => {
  it("returns true for content with markdown headings", () => {
    expect(isStructuredContent("## Hero Rewrite Options\nHere are three variants.")).toBe(true);
  });

  it("returns true for content with bullet lists", () => {
    expect(
      isStructuredContent("Key points:\n- Point one with detail\n- Point two with detail\n- Point three with detail"),
    ).toBe(true);
  });

  it("returns true for content with numbered lists", () => {
    expect(
      isStructuredContent("Steps:\n1. First step\n2. Second step\n3. Third step"),
    ).toBe(true);
  });

  it("returns true for content with bold text", () => {
    expect(isStructuredContent("The **key takeaway** is that we need to focus on conversion.")).toBe(true);
  });

  it("returns true for content with tables", () => {
    expect(isStructuredContent("| Feature | Value |\n|---|---|\n| Speed | Fast |")).toBe(true);
  });

  it("returns false for short plain text", () => {
    expect(isStructuredContent("Sure, I can help with that.")).toBe(false);
  });

  it("returns false for conversational responses", () => {
    expect(isStructuredContent("That's a great question. Let me think about it.")).toBe(false);
  });

  it("returns true for long content even without markdown", () => {
    const longText = "A".repeat(500);
    expect(isStructuredContent(longText)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. deriveArtifactTitle — title extraction
// ═══════════════════════════════════════════════════════════

describe("deriveArtifactTitle", () => {
  it("extracts markdown heading", () => {
    expect(deriveArtifactTitle("## Hero Rewrite Options\nContent here")).toBe(
      "Hero Rewrite Options",
    );
  });

  it("extracts bold first line", () => {
    expect(deriveArtifactTitle("**Launch Strategy**\nMore content")).toBe(
      "Launch Strategy",
    );
  });

  it("uses first line when no heading or bold", () => {
    expect(deriveArtifactTitle("Product Hunt Launch Pack\nDetails follow")).toBe(
      "Product Hunt Launch Pack",
    );
  });

  it("truncates long titles", () => {
    const longTitle = "A".repeat(80) + "\nBody content";
    const title = deriveArtifactTitle(longTitle);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Dedup persistence
// ═══════════════════════════════════════════════════════════

describe("dedup persistence", () => {
  it("starts with empty set", () => {
    clearPersistedMessages();
    expect(getPersistedMessageIds().size).toBe(0);
  });

  it("persists message IDs", () => {
    clearPersistedMessages();
    markMessagesPersisted(["msg-1", "msg-2"]);
    const ids = getPersistedMessageIds();
    expect(ids.has("msg-1")).toBe(true);
    expect(ids.has("msg-2")).toBe(true);
  });

  it("accumulates across calls", () => {
    clearPersistedMessages();
    markMessagesPersisted(["msg-1"]);
    markMessagesPersisted(["msg-2"]);
    const ids = getPersistedMessageIds();
    expect(ids.size).toBe(2);
  });

  it("does not duplicate IDs", () => {
    clearPersistedMessages();
    markMessagesPersisted(["msg-1"]);
    markMessagesPersisted(["msg-1"]);
    const ids = getPersistedMessageIds();
    expect(ids.size).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Hook file structure
// ═══════════════════════════════════════════════════════════

describe("useAutoArtifacts hook structure", () => {
  it("hook file exists", () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it("exports useAutoArtifacts function", () => {
    const src = readHook();
    expect(src).toContain("export function useAutoArtifacts");
  });

  it("exports inferArtifactType function", () => {
    const src = readHook();
    expect(src).toContain("export function inferArtifactType");
  });

  it("exports isStructuredContent function", () => {
    const src = readHook();
    expect(src).toContain("export function isStructuredContent");
  });

  it("uses localStorage for dedup", () => {
    const src = readHook();
    expect(src).toContain("localStorage");
  });

  it("creates artifacts via client.createArtifact", () => {
    const src = readHook();
    expect(src).toContain("createArtifact");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Integration in ActionSessionView
// ═══════════════════════════════════════════════════════════

describe("ActionSessionView artifact integration", () => {
  it("imports useAutoArtifacts", () => {
    const src = readFileSync(
      resolve(__dirname, "../../apps/desktop/src/features/action-session/components/ActionSessionView.tsx"),
      "utf-8",
    );
    expect(src).toContain("useAutoArtifacts");
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Integration in ChatWorkspace
// ═══════════════════════════════════════════════════════════

describe("ChatWorkspace artifact integration", () => {
  it("imports useAutoArtifacts", () => {
    const src = readFileSync(
      resolve(__dirname, "../../apps/desktop/src/features/chat/components/ChatWorkspace.tsx"),
      "utf-8",
    );
    expect(src).toContain("useAutoArtifacts");
  });
});
