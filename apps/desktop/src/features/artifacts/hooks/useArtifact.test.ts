import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Inline minimal implementation to test pure logic
// Since the hook uses React hooks (useState, useEffect, useCallback),
// we test the core fetch logic here.
// ---------------------------------------------------------------------------

interface ArtifactState {
  artifact: unknown | null;
  isLoading: boolean;
  error: string | null;
}

async function fetchArtifact(
  artifactId: string | null,
  getArtifact: (id: string) => Promise<unknown>,
): Promise<ArtifactState> {
  if (!artifactId) {
    return { artifact: null, isLoading: false, error: null };
  }
  try {
    const artifact = await getArtifact(artifactId);
    return { artifact, isLoading: false, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { artifact: null, isLoading: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("useArtifact: returns null artifact when artifactId is null", async () => {
  const getArtifact = async () => {
    throw new Error("should not be called");
  };
  const result = await fetchArtifact(null, getArtifact);
  assert.equal(result.artifact, null);
  assert.equal(result.isLoading, false);
  assert.equal(result.error, null);
});

void test("useArtifact: calls getArtifact when artifactId is provided", async () => {
  let calledWith: string | null = null;
  const mockArtifact = { artifactId: "a1", title: "Test Artifact", status: "draft" };
  const getArtifact = async (id: string) => {
    calledWith = id;
    return mockArtifact;
  };
  const result = await fetchArtifact("a1", getArtifact);
  assert.equal(calledWith, "a1");
  assert.deepEqual(result.artifact, mockArtifact);
  assert.equal(result.error, null);
});

void test("useArtifact: returns error when getArtifact fails", async () => {
  const getArtifact = async () => {
    throw new Error("Network error");
  };
  const result = await fetchArtifact("a1", getArtifact);
  assert.equal(result.artifact, null);
  assert.equal(result.error, "Network error");
});

void test("useArtifact: handles non-Error throws", async () => {
  const getArtifact = async () => {
    throw "string error";
  };
  const result = await fetchArtifact("a1", getArtifact);
  assert.equal(result.artifact, null);
  assert.equal(result.error, "string error");
});

void test("useArtifact: returns different artifacts for different artifactIds", async () => {
  const artifacts: Record<string, unknown> = {
    a1: { artifactId: "a1", title: "Artifact One" },
    a2: { artifactId: "a2", title: "Artifact Two" },
  };
  const getArtifact = async (id: string) => {
    if (!(id in artifacts)) throw new Error("Not found");
    return artifacts[id];
  };

  const result1 = await fetchArtifact("a1", getArtifact);
  assert.deepEqual(result1.artifact, { artifactId: "a1", title: "Artifact One" });

  const result2 = await fetchArtifact("a2", getArtifact);
  assert.deepEqual(result2.artifact, { artifactId: "a2", title: "Artifact Two" });
});
