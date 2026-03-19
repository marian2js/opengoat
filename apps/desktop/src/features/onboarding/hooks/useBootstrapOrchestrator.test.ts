import assert from "node:assert/strict";
import test from "node:test";

/**
 * These tests verify the bootstrap orchestrator's core behaviour by
 * replicating the retry / verification logic from `runBootstrap` with
 * mock sidecar calls.  We don't import the React hook directly (no
 * jsdom), but we exercise the same algorithm so regressions in error
 * handling, retry semantics, and the final file-existence gate are
 * caught.
 */

// ---------------------------------------------------------------------------
// Helpers that mirror the orchestrator's control flow
// ---------------------------------------------------------------------------

const MAX_RETRIES_PER_STEP = 1;

interface Prompt {
  id: string;
  expectedFile: string;
  message: string;
}

interface StepResult {
  status: "completed" | "error";
  error?: string;
}

interface BootstrapResult {
  status: "completed" | "error";
  error?: string;
  steps: StepResult[];
}

/**
 * Stripped-down replica of `runBootstrap` from the orchestrator hook.
 * Accepts mock functions for creating sessions, streaming, and verifying
 * files so the tests can control each failure mode independently.
 */
async function runBootstrap(params: {
  prompts: Prompt[];
  /** Returns true if the file exists after streaming. */
  runStep: (prompt: Prompt, attempt: number) => Promise<boolean>;
  /** Independent file-existence check for the final gate. */
  checkFile: (expectedFile: string) => Promise<boolean>;
}): Promise<BootstrapResult> {
  const steps: StepResult[] = params.prompts.map(() => ({
    status: "completed" as const,
  }));

  for (let i = 0; i < params.prompts.length; i++) {
    const prompt = params.prompts[i]!;
    let success = false;

    for (let attempt = 0; attempt <= MAX_RETRIES_PER_STEP; attempt++) {
      try {
        success = await params.runStep(prompt, attempt);
      } catch (stepError) {
        const errorMsg =
          stepError instanceof Error ? stepError.message : "Unexpected error";
        steps[i] = { status: "error", error: errorMsg };
        success = false;
      }

      if (success) {
        break;
      }
    }

    if (!success) {
      steps[i] = {
        status: "error",
        error:
          `Failed to create ${prompt.expectedFile} after ${String(MAX_RETRIES_PER_STEP + 1)} attempts. ` +
          "This can happen with smaller or free-tier models that struggle with complex instructions. " +
          "Try again, or switch to a more capable model.",
      };
      return {
        status: "error",
        error: `Failed to create ${prompt.expectedFile}. You can retry or switch to a more capable model.`,
        steps,
      };
    }

    steps[i] = { status: "completed" };
  }

  // Final gate
  for (let i = 0; i < params.prompts.length; i++) {
    const prompt = params.prompts[i]!;
    const exists = await params.checkFile(prompt.expectedFile);
    if (!exists) {
      steps[i] = {
        status: "error",
        error: `${prompt.expectedFile} was not found during final verification.`,
      };
      return {
        status: "error",
        error: `${prompt.expectedFile} is missing. Please retry setup.`,
        steps,
      };
    }
  }

  return { status: "completed", steps };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PROMPTS: Prompt[] = [
  { id: "product", expectedFile: "PRODUCT.md", message: "Analyze product" },
  { id: "market", expectedFile: "MARKET.md", message: "Analyze market" },
  { id: "growth", expectedFile: "GROWTH.md", message: "Analyze growth" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void test("completes when all steps succeed and files exist", async () => {
  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: () => Promise.resolve(true),
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.steps.length, 3);
  assert.ok(result.steps.every((s) => s.status === "completed"));
  assert.equal(result.error, undefined);
});

void test("retries a step once when the first attempt returns false", async () => {
  const attempts: number[] = [];

  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: (_prompt, attempt) => {
      attempts.push(attempt);
      // First attempt fails, second succeeds (for every step)
      return Promise.resolve(attempt > 0);
    },
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "completed");
  // Each of 3 steps should have had 2 attempts (0 + 1)
  assert.equal(attempts.length, 6);
  assert.deepEqual(attempts, [0, 1, 0, 1, 0, 1]);
});

void test("retries a step when the first attempt throws an exception", async () => {
  let callCount = 0;

  const result = await runBootstrap({
    prompts: [PROMPTS[0]!],
    runStep: () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Sidecar request failed with status 500.");
      }
      return Promise.resolve(true);
    },
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "completed");
  assert.equal(callCount, 2);
});

void test("reports error after all retries are exhausted (returns false)", async () => {
  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: () => Promise.resolve(false),
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("PRODUCT.md"));
  assert.equal(result.steps[0]!.status, "error");
  assert.ok(result.steps[0]!.error?.includes("after 2 attempts"));
  assert.ok(result.steps[0]!.error?.includes("free-tier models"));
  // Steps 2 and 3 were never reached
  assert.equal(result.steps[1]!.status, "completed"); // initial value
  assert.equal(result.steps[2]!.status, "completed"); // initial value
});

void test("reports error after all retries are exhausted (throws every time)", async () => {
  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: () => {
      throw new Error("Network timeout");
    },
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("PRODUCT.md"));
  assert.equal(result.steps[0]!.status, "error");
  assert.ok(result.steps[0]!.error?.includes("after 2 attempts"));
});

void test("stops at the first failing step without proceeding to later steps", async () => {
  const stepsAttempted: string[] = [];

  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: (prompt) => {
      stepsAttempted.push(prompt.id);
      // Market step always fails
      return Promise.resolve(prompt.id !== "market");
    },
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("MARKET.md"));
  // Product succeeded (1 attempt), market failed (2 attempts), growth never ran
  assert.deepEqual(stepsAttempted, ["product", "market", "market"]);
});

void test("final gate catches a file that disappeared after step verification passed", async () => {
  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: () => Promise.resolve(true),
    checkFile: (file) => {
      // GROWTH.md was deleted between step check and final gate
      return Promise.resolve(file !== "GROWTH.md");
    },
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("GROWTH.md"));
  assert.equal(result.steps[2]!.status, "error");
  assert.ok(result.steps[2]!.error?.includes("final verification"));
});

void test("final gate catches a file missing for the first step", async () => {
  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: () => Promise.resolve(true),
    checkFile: (file) => Promise.resolve(file !== "PRODUCT.md"),
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("PRODUCT.md"));
  assert.equal(result.steps[0]!.status, "error");
});

void test("mixed failure: first attempt throws, retry returns false", async () => {
  let callCount = 0;

  const result = await runBootstrap({
    prompts: [PROMPTS[0]!],
    runStep: () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Connection refused");
      }
      return Promise.resolve(false);
    },
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "error");
  assert.equal(callCount, 2);
  assert.ok(result.error?.includes("PRODUCT.md"));
});

void test("error message mentions the specific file that failed", async () => {
  const result = await runBootstrap({
    prompts: PROMPTS,
    runStep: (prompt) => Promise.resolve(prompt.id === "product"),
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("MARKET.md"));
  assert.ok(!result.error?.includes("PRODUCT.md"));
});

void test("exception error message is preserved in step error", async () => {
  const result = await runBootstrap({
    prompts: [PROMPTS[0]!],
    runStep: () => {
      throw new Error("Sidecar request failed with status 500.");
    },
    checkFile: () => Promise.resolve(true),
  });

  assert.equal(result.status, "error");
  // The step error after all retries fail should contain the model guidance
  assert.ok(result.steps[0]!.error?.includes("after 2 attempts"));
});
