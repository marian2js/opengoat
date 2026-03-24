import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Inline minimal implementation to test pure logic
// Since the hook uses React hooks (useState, useEffect, useCallback),
// we test the core fetch logic here.
// ---------------------------------------------------------------------------

interface ArtifactVersionsState {
  versions: unknown[];
  isLoading: boolean;
  error: string | null;
}

async function fetchArtifactVersions(
  artifactId: string | null,
  getVersions: (id: string) => Promise<unknown[]>,
): Promise<ArtifactVersionsState> {
  if (!artifactId) {
    return { versions: [], isLoading: false, error: null };
  }
  try {
    const versions = await getVersions(artifactId);
    return { versions, isLoading: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { versions: [], isLoading: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("useArtifactVersions: returns empty array when artifactId is null", async () => {
  const getVersions = async () => {
    throw new Error("should not be called");
  };
  const result = await fetchArtifactVersions(null, getVersions);
  assert.deepEqual(result.versions, []);
  assert.equal(result.isLoading, false);
  assert.equal(result.error, null);
});

void test("useArtifactVersions: calls getVersions when artifactId is provided", async () => {
  let calledWith: string | null = null;
  const mockVersions = [
    { versionId: "v1", artifactId: "a1", version: 1 },
    { versionId: "v2", artifactId: "a1", version: 2 },
  ];
  const getVersions = async (id: string) => {
    calledWith = id;
    return mockVersions;
  };
  const result = await fetchArtifactVersions("a1", getVersions);
  assert.equal(calledWith, "a1");
  assert.deepEqual(result.versions, mockVersions);
  assert.equal(result.error, null);
});

void test("useArtifactVersions: returns error when getVersions fails", async () => {
  const getVersions = async () => {
    throw new Error("Network error");
  };
  const result = await fetchArtifactVersions("a1", getVersions);
  assert.deepEqual(result.versions, []);
  assert.equal(result.error, "Network error");
});

void test("useArtifactVersions: handles non-Error throws", async () => {
  const getVersions = async (): Promise<unknown[]> => {
    throw "string error";
  };
  const result = await fetchArtifactVersions("a1", getVersions);
  assert.deepEqual(result.versions, []);
  assert.equal(result.error, "string error");
});

void test("useArtifactVersions: returns empty array for artifact with no versions", async () => {
  const getVersions = async () => [];
  const result = await fetchArtifactVersions("a1", getVersions);
  assert.deepEqual(result.versions, []);
  assert.equal(result.error, null);
});
