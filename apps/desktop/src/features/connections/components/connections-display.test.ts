import assert from "node:assert/strict";
import test from "node:test";
import { cleanProviderName } from "../../agents/display-helpers";

void test("connections provider column cleans auth-action phrases", () => {
  // ConnectionsWorkspace must apply cleanProviderName to connection.providerName
  assert.equal(cleanProviderName("Sign in with GitHub"), "GitHub Copilot");
});

void test("connections provider column preserves clean provider names", () => {
  assert.equal(cleanProviderName("OpenAI"), "OpenAI");
});

void test("connections provider column cleans API key auth text", () => {
  assert.equal(cleanProviderName("Use API key"), "API Key");
});
