import { describe, expect, it, vi } from "vitest";
import { extractSessionId } from "../../packages/sidecar/src/artifact-extractor/session-id.ts";
import {
  bundleUnbundledArtifacts,
  type BundleGrouperDeps,
} from "../../packages/sidecar/src/artifact-extractor/bundle-grouper.ts";
import type { ArtifactRecord, BundleRecord } from "@opengoat/core";

// ---------------------------------------------------------------------------
// extractSessionId: contentRef format normalization
// ---------------------------------------------------------------------------
describe("extractSessionId", () => {
  it("extracts session UUID from chat:// format", () => {
    expect(extractSessionId("chat://252dd42d-6f64-4a64-8692-d9121a83aca4/0")).toBe(
      "252dd42d-6f64-4a64-8692-d9121a83aca4",
    );
  });

  it("extracts session UUID from chat:// format with higher message index", () => {
    expect(extractSessionId("chat://abc-123/5")).toBe("abc-123");
  });

  it("extracts session UUID from session: format", () => {
    expect(extractSessionId("session:252dd42d-6f64-4a64-8692-d9121a83aca4/message:msg-1")).toBe(
      "252dd42d-6f64-4a64-8692-d9121a83aca4",
    );
  });

  it("extracts session UUID from session: format without message part", () => {
    expect(extractSessionId("session:abc-123")).toBe("abc-123");
  });

  it("returns null for unknown contentRef formats", () => {
    expect(extractSessionId("file:///tmp/artifact.md")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSessionId("")).toBeNull();
  });

  it("handles chat:// format without trailing index", () => {
    expect(extractSessionId("chat://my-session-id")).toBe("my-session-id");
  });
});

// ---------------------------------------------------------------------------
// bundleUnbundledArtifacts: post-hoc grouping
// ---------------------------------------------------------------------------
describe("bundleUnbundledArtifacts", () => {
  function makeMockArtifact(overrides: Partial<ArtifactRecord>): ArtifactRecord {
    return {
      artifactId: "art-1",
      projectId: "proj-1",
      type: "matrix",
      title: "Test Artifact",
      status: "draft",
      format: "markdown",
      contentRef: "chat://sess-1/0",
      version: 1,
      createdBy: "market-intel",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      ...overrides,
    };
  }

  function createMockDeps(unbundledArtifacts: ArtifactRecord[]): BundleGrouperDeps {
    let bundleCounter = 0;
    return {
      artifactService: {
        listUnbundledArtifacts: vi.fn().mockResolvedValue(unbundledArtifacts),
        createBundle: vi.fn().mockImplementation((_paths, opts) => {
          bundleCounter++;
          return Promise.resolve({
            bundleId: `bnd-mock-${bundleCounter}`,
            projectId: opts.projectId,
            title: opts.title,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          } satisfies BundleRecord);
        }),
        assignBundle: vi.fn().mockResolvedValue(undefined),
      },
      opengoatPaths: { homeDir: "/tmp/test" } as any,
      specialistLookup: (id: string) => {
        const map: Record<string, string> = {
          "market-intel": "Market Intel",
          "website-conversion": "Website Conversion",
          "outbound": "Outbound",
        };
        return map[id] ?? id;
      },
    };
  }

  it("creates a bundle for 2+ artifacts sharing the same session ID", async () => {
    const artifacts = [
      makeMockArtifact({
        artifactId: "art-1",
        contentRef: "chat://sess-A/0",
        createdBy: "market-intel",
        type: "matrix",
        title: "Competitor Matrix",
      }),
      makeMockArtifact({
        artifactId: "art-2",
        contentRef: "session:sess-A/message:msg-1",
        createdBy: "market-intel",
        type: "research_brief",
        title: "Market Brief",
      }),
    ];

    const deps = createMockDeps(artifacts);
    const result = await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    expect(deps.artifactService.createBundle).toHaveBeenCalledTimes(1);
    expect(deps.artifactService.createBundle).toHaveBeenCalledWith(
      deps.opengoatPaths,
      expect.objectContaining({
        projectId: "proj-1",
        title: expect.stringContaining("Market Intel"),
      }),
    );
    expect(deps.artifactService.assignBundle).toHaveBeenCalledWith(
      deps.opengoatPaths,
      ["art-1", "art-2"],
      "bnd-mock-1",
    );
    expect(result.bundlesCreated).toBe(1);
    expect(result.artifactsBundled).toBe(2);
  });

  it("does not create bundles for single-artifact sessions", async () => {
    const artifacts = [
      makeMockArtifact({
        artifactId: "art-1",
        contentRef: "chat://sess-A/0",
        createdBy: "market-intel",
      }),
      makeMockArtifact({
        artifactId: "art-2",
        contentRef: "chat://sess-B/0",
        createdBy: "outbound",
      }),
    ];

    const deps = createMockDeps(artifacts);
    const result = await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    expect(deps.artifactService.createBundle).not.toHaveBeenCalled();
    expect(deps.artifactService.assignBundle).not.toHaveBeenCalled();
    expect(result.bundlesCreated).toBe(0);
    expect(result.artifactsBundled).toBe(0);
  });

  it("handles multiple sessions needing bundles", async () => {
    const artifacts = [
      // Session A - 2 artifacts
      makeMockArtifact({ artifactId: "art-1", contentRef: "chat://sess-A/0", createdBy: "market-intel", title: "Matrix" }),
      makeMockArtifact({ artifactId: "art-2", contentRef: "session:sess-A/message:m1", createdBy: "market-intel", title: "Brief" }),
      // Session B - 3 artifacts
      makeMockArtifact({ artifactId: "art-3", contentRef: "chat://sess-B/0", createdBy: "outbound", title: "Emails" }),
      makeMockArtifact({ artifactId: "art-4", contentRef: "chat://sess-B/1", createdBy: "outbound", title: "Subjects" }),
      makeMockArtifact({ artifactId: "art-5", contentRef: "session:sess-B/message:m2", createdBy: "outbound", title: "Angles" }),
    ];

    const deps = createMockDeps(artifacts);
    const result = await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    expect(deps.artifactService.createBundle).toHaveBeenCalledTimes(2);
    expect(result.bundlesCreated).toBe(2);
    expect(result.artifactsBundled).toBe(5);
  });

  it("skips artifacts with unparseable contentRef", async () => {
    const artifacts = [
      makeMockArtifact({ artifactId: "art-1", contentRef: "chat://sess-A/0", createdBy: "market-intel" }),
      makeMockArtifact({ artifactId: "art-2", contentRef: "file:///unknown", createdBy: "market-intel" }),
    ];

    const deps = createMockDeps(artifacts);
    const result = await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    // Only 1 artifact in sess-A, unparseable one is skipped, so no bundle
    expect(deps.artifactService.createBundle).not.toHaveBeenCalled();
    expect(result.bundlesCreated).toBe(0);
  });

  it("returns zero counts when no unbundled artifacts exist", async () => {
    const deps = createMockDeps([]);
    const result = await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    expect(result.bundlesCreated).toBe(0);
    expect(result.artifactsBundled).toBe(0);
  });

  it("derives bundle title using specialist name from the majority creator", async () => {
    const artifacts = [
      makeMockArtifact({
        artifactId: "art-1",
        contentRef: "chat://sess-A/0",
        createdBy: "market-intel",
        type: "matrix",
        title: "Competitor Matrix",
      }),
      makeMockArtifact({
        artifactId: "art-2",
        contentRef: "session:sess-A/message:m1",
        createdBy: "market-intel",
        type: "matrix",
        title: "Market Gaps",
      }),
    ];

    const deps = createMockDeps(artifacts);
    await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    const bundleArgs = (deps.artifactService.createBundle as any).mock.calls[0][1];
    // Same type → "Market Intel: Matrix Bundle"
    expect(bundleArgs.title).toBe("Market Intel: Matrix Bundle");
  });

  it("uses first artifact title when types differ", async () => {
    const artifacts = [
      makeMockArtifact({
        artifactId: "art-1",
        contentRef: "chat://sess-A/0",
        createdBy: "market-intel",
        type: "matrix",
        title: "Competitor Matrix",
      }),
      makeMockArtifact({
        artifactId: "art-2",
        contentRef: "session:sess-A/message:m1",
        createdBy: "market-intel",
        type: "research_brief",
        title: "Market Brief",
      }),
    ];

    const deps = createMockDeps(artifacts);
    await bundleUnbundledArtifacts(deps.opengoatPaths, "proj-1", deps);

    const bundleArgs = (deps.artifactService.createBundle as any).mock.calls[0][1];
    // Mixed types → "Market Intel: Competitor Matrix"
    expect(bundleArgs.title).toBe("Market Intel: Competitor Matrix");
  });
});
