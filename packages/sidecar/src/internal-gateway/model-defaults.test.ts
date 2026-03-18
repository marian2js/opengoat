import assert from "node:assert/strict";
import test from "node:test";
import { defaultModelForProvider, normalizeGatewayModelRef } from "./model-defaults.ts";

void test("github-copilot falls back to the embedded runtime default model", () => {
  assert.equal(defaultModelForProvider("github-copilot"), "github-copilot/gpt-4o");
  assert.equal(
    normalizeGatewayModelRef({
      providerId: "github-copilot",
    }),
    "github-copilot/gpt-4o",
  );
});
