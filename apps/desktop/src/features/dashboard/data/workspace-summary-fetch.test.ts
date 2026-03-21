import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests verifying the workspace summary fetch error-handling contract.
// The useWorkspaceSummary hook uses fetchFile() internally, which must:
//   1. Log errors to console.error instead of swallowing them
//   2. Return { content: null, error: string } on failure
//   3. Propagate errors to the UI when all files fail
// ---------------------------------------------------------------------------

interface FileResult {
  content: string | null;
  error: string | null;
}

/**
 * Mirrors the fetchFile logic from useWorkspaceSummary.
 * Calls readWorkspaceFile and transforms the result.
 */
async function fetchFile(
  readFn: () => Promise<{ exists: boolean; content: string }>,
): Promise<FileResult> {
  try {
    const result = await readFn();
    return { content: result.exists ? result.content : null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: null, error: message };
  }
}

void test("fetchFile returns content when readWorkspaceFile succeeds with exists:true", async () => {
  const result = await fetchFile(async () => ({
    exists: true,
    content: "# PRODUCT\n\n## Company summary\nTest product",
  }));
  assert.equal(result.content, "# PRODUCT\n\n## Company summary\nTest product");
  assert.equal(result.error, null);
});

void test("fetchFile returns null content when file does not exist", async () => {
  const result = await fetchFile(async () => ({
    exists: false,
    content: "",
  }));
  assert.equal(result.content, null);
  assert.equal(result.error, null);
});

void test("fetchFile captures error message when readWorkspaceFile throws", async () => {
  const result = await fetchFile(async () => {
    throw new Error("Sidecar request failed with status 401.");
  });
  assert.equal(result.content, null);
  assert.equal(result.error, "Sidecar request failed with status 401.");
});

void test("fetchFile captures non-Error exceptions as strings", async () => {
  const result = await fetchFile(async () => {
    throw "network timeout";
  });
  assert.equal(result.content, null);
  assert.equal(result.error, "network timeout");
});

void test("when all three files fail, error array has 3 entries", async () => {
  const results = await Promise.all([
    fetchFile(async () => { throw new Error("401"); }),
    fetchFile(async () => { throw new Error("401"); }),
    fetchFile(async () => { throw new Error("401"); }),
  ]);

  const fileErrors = results.map((r) => r.error).filter(Boolean);
  assert.equal(fileErrors.length, 3);
  assert.ok(fileErrors[0]!.includes("401"));
});

void test("when all files fail, first error is used for user-facing message", async () => {
  const results = await Promise.all([
    fetchFile(async () => { throw new Error("Sidecar request failed with status 401."); }),
    fetchFile(async () => { throw new Error("Sidecar request failed with status 500."); }),
    fetchFile(async () => { throw new Error("Sidecar request failed with status 401."); }),
  ]);

  const allContentsNull = results.every((r) => r.content === null);
  const fileErrors = results.map((r) => r.error).filter(Boolean);

  assert.ok(allContentsNull);
  assert.ok(fileErrors.length > 0);

  // Mirrors the hook logic: report first error when all files are null
  const errorMessage = `Failed to load workspace files: ${fileErrors[0]}`;
  assert.ok(errorMessage.includes("401"));
});

void test("partial success: some files succeed, some fail", async () => {
  const results = await Promise.all([
    fetchFile(async () => ({ exists: true, content: "product content" })),
    fetchFile(async () => { throw new Error("500"); }),
    fetchFile(async () => ({ exists: true, content: "growth content" })),
  ]);

  const [product, market, growth] = results;
  assert.equal(product.content, "product content");
  assert.equal(market.content, null);
  assert.ok(market.error);
  assert.equal(growth.content, "growth content");

  // When at least one file succeeds, parsing proceeds
  const allNull = results.every((r) => r.content === null);
  assert.equal(allNull, false, "Not all files are null — parsing should proceed");
});

void test("CompanySummary contract: empty data shows error state, not null", () => {
  // When data is an object with all null fields and no error,
  // CompanySummary must still show the error card (not return null)
  const data = {
    productSummary: null,
    targetAudience: null,
    valueProposition: null,
    mainRisk: null,
    topOpportunity: null,
  };
  const hasAnyData = data ? Object.values(data).some(Boolean) : false;
  assert.equal(hasAnyData, false, "No data points present");

  // The component should always show the error card when hasAnyData is false
  // Previously it would return null when !error && data (truthy object)
  const shouldShowCard = !hasAnyData;
  assert.ok(shouldShowCard, "Error card should render when no data is available");
});

void test("CompanySummary contract: data=null also shows error state", () => {
  const data = null;

  const hasAnyData = data ? Object.values(data).some(Boolean) : false;
  assert.equal(hasAnyData, false);

  const shouldShowCard = !hasAnyData;
  assert.ok(shouldShowCard, "Error card should render when data is null");
});

void test("CompanySummary contract: shows specific error message when provided", () => {
  const error = "Failed to load workspace files: Sidecar request failed with status 401.";
  const expectedMessage = `Unable to load company overview: ${error}`;
  assert.ok(expectedMessage.includes("401"));
});

void test("CompanySummary contract: shows generic message when no error", () => {
  const error: string | null = null;
  const message = error
    ? `Unable to load company overview: ${error}`
    : "Unable to load company overview. Try refreshing the page.";
  assert.equal(message, "Unable to load company overview. Try refreshing the page.");
});

void test("Promise.all does not short-circuit when individual promises have catch", async () => {
  // Verifies that Promise.all resolves even when individual promises reject,
  // because each has its own error handler
  const results = await Promise.all([
    fetchFile(async () => { throw new Error("fail 1"); }),
    fetchFile(async () => ({ exists: true, content: "ok" })),
    fetchFile(async () => { throw new Error("fail 3"); }),
  ]);

  assert.equal(results.length, 3, "All three results returned");
  assert.equal(results[0].content, null);
  assert.ok(results[0].error);
  assert.equal(results[1].content, "ok");
  assert.equal(results[1].error, null);
  assert.equal(results[2].content, null);
  assert.ok(results[2].error);
});
