import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Unit tests for brain-section-timestamps utility
// ---------------------------------------------------------------------------

describe("brain-section-timestamps utility", () => {
  let mod: typeof import("../../apps/desktop/src/features/brain/lib/brain-section-timestamps");

  const STORAGE_KEY = "opengoat:brain-section-timestamps";

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function load() {
    mod = await import("../../apps/desktop/src/features/brain/lib/brain-section-timestamps");
    return mod;
  }

  it("returns null when no timestamp has been stored", async () => {
    const { getSectionTimestamp } = await load();
    expect(getSectionTimestamp("agent-1", "PRODUCT.md")).toBeNull();
  });

  it("stores and retrieves a timestamp", async () => {
    const { getSectionTimestamp, setSectionTimestamp } = await load();
    const before = Date.now();
    setSectionTimestamp("agent-1", "PRODUCT.md");
    const ts = getSectionTimestamp("agent-1", "PRODUCT.md");
    expect(ts).not.toBeNull();
    const parsed = new Date(ts!).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(Date.now());
  });

  it("stores timestamps independently per agent and filename", async () => {
    const { getSectionTimestamp, setSectionTimestamp } = await load();
    setSectionTimestamp("agent-1", "PRODUCT.md");
    setSectionTimestamp("agent-2", "MARKET.md");
    expect(getSectionTimestamp("agent-1", "PRODUCT.md")).not.toBeNull();
    expect(getSectionTimestamp("agent-2", "MARKET.md")).not.toBeNull();
    expect(getSectionTimestamp("agent-1", "MARKET.md")).toBeNull();
  });

  it("detects content changes via hash comparison", async () => {
    const { hasContentChanged, setContentHash } = await load();
    setContentHash("agent-1", "PRODUCT.md", "hello world");
    expect(hasContentChanged("agent-1", "PRODUCT.md", "hello world")).toBe(false);
    expect(hasContentChanged("agent-1", "PRODUCT.md", "updated content")).toBe(true);
  });

  it("returns true for hasContentChanged when no hash stored", async () => {
    const { hasContentChanged } = await load();
    // No prior hash — treat as changed (new file)
    expect(hasContentChanged("agent-1", "PRODUCT.md", "some content")).toBe(true);
  });

  it("persists data to localStorage under the correct key", async () => {
    const { setSectionTimestamp } = await load();
    setSectionTimestamp("agent-1", "PRODUCT.md");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );
  });
});

// ---------------------------------------------------------------------------
// UI integration tests — SectionHeader shows timestamp
// ---------------------------------------------------------------------------

const brainSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/brain/components/BrainWorkspace.tsx"),
  "utf-8",
);

describe("Brain section freshness indicator — SectionHeader", () => {
  // AC1: SectionHeader accepts and renders a lastUpdated prop
  it("SectionHeader accepts a lastUpdated prop", () => {
    // The SectionHeader function signature should include lastUpdated
    expect(brainSrc).toMatch(/lastUpdated\??:\s*string\s*\|\s*null/);
  });

  // AC2: Timestamp uses 11px mono muted styling consistent with chat timestamps
  it("uses the metadata timestamp styling class", () => {
    // Should have the exact metadata styling for the timestamp
    expect(brainSrc).toMatch(/text-\[11px\].*font-mono.*text-muted-foreground\/\d+/);
    expect(brainSrc).toMatch(/tabular-nums/);
  });

  // AC3: Uses formatRelativeTime from the shared utility
  it("imports formatRelativeTime from the shared output-labels utility", () => {
    expect(brainSrc).toMatch(/import.*formatRelativeTime.*from.*output-labels/);
  });

  // AC4: Timestamp only renders when lastUpdated is truthy
  it("conditionally renders timestamp only when lastUpdated is present", () => {
    expect(brainSrc).toMatch(/lastUpdated\s*[?&]/);
  });

  // AC5: BrainEditor tracks timestamps via the utility
  it("imports brain-section-timestamps utility", () => {
    expect(brainSrc).toMatch(/from.*brain-section-timestamps/);
  });

  // AC6: Timestamp is updated on successful save
  it("calls setSectionTimestamp on successful file write", () => {
    expect(brainSrc).toMatch(/setSectionTimestamp/);
  });

  // AC7: Content hash is tracked for detecting external changes (Refine)
  it("tracks content hash for detecting external changes", () => {
    expect(brainSrc).toMatch(/setContentHash|hasContentChanged/);
  });
});
