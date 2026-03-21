import assert from "node:assert/strict";
import test from "node:test";
import { formatAgentCount, cleanProviderName } from "../display-helpers";

void test("formatAgentCount returns singular for count of 1", () => {
  assert.equal(formatAgentCount(1), "1 agent available");
});

void test("formatAgentCount returns plural for count of 0", () => {
  assert.equal(formatAgentCount(0), "0 agents available");
});

void test("formatAgentCount returns plural for count > 1", () => {
  assert.equal(formatAgentCount(5), "5 agents available");
});

void test("cleanProviderName maps auth action phrases to provider names", () => {
  assert.equal(cleanProviderName("Sign in with GitHub"), "GitHub Copilot");
});

void test("cleanProviderName passes through clean provider names unchanged", () => {
  assert.equal(cleanProviderName("OpenAI"), "OpenAI");
});

void test("cleanProviderName handles ChatGPT (Codex) label", () => {
  assert.equal(cleanProviderName("ChatGPT (Codex)"), "ChatGPT (Codex)");
});

void test("cleanProviderName maps Use API key with context", () => {
  assert.equal(cleanProviderName("Use API key"), "API Key");
});
