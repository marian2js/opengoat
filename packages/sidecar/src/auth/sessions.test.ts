import assert from "node:assert/strict";
import test from "node:test";
import type { WizardPrompterLike } from "./runtime-modules.ts";
import { RuntimeAuthSessionManager } from "./sessions.ts";

void test("auth sessions fail when a flow returns without a saved connection", async () => {
  const manager = new RuntimeAuthSessionManager(() => ({
    applyAuthChoice() {
      return Promise.resolve({
        overview: {
          configPath: "/tmp/runtime.json",
          connections: [],
          providers: [],
          selectedProfileId: undefined,
          selectedProviderId: undefined,
          storePath: "/tmp/auth-profiles.json",
        },
      });
    },
    getMethod() {
      return Promise.resolve({
        input: "oauth" as const,
        label: "Sign in with GitHub",
        providerId: "github-copilot",
        providerName: "Copilot",
      });
    },
  }) as never);

  const session = await manager.start({ authChoice: "github-copilot" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const updated = manager.get(session.id);

  assert.ok(updated);
  assert.equal(updated.state, "error");
  assert.equal(updated.step.type, "error");
  assert.match(updated.step.message, /did not create a saved connection/i);
});

void test("auth sessions expose auth-link steps before completion", async () => {
  let resolveCompletion!: () => void;
  const completionGate = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  const manager = new RuntimeAuthSessionManager(() => ({
    async applyAuthChoice({ prompter }: { prompter: WizardPrompterLike }) {
      await prompter.authLink?.({
        instructions: "Enter the code in GitHub.",
        label: "Open GitHub",
        url: "https://github.com/login/device",
      });
      await completionGate;
      return {
        connection: {
          isDefault: true,
          label: "github",
          profileId: "github-copilot:github",
          providerId: "github-copilot",
          providerName: "Copilot",
          type: "token" as const,
          updatedAt: new Date().toISOString(),
        },
        overview: {
          configPath: "/tmp/runtime.json",
          connections: [],
          providers: [],
          selectedProfileId: "github-copilot:github",
          selectedProviderId: "github-copilot",
          storePath: "/tmp/auth-profiles.json",
        },
      };
    },
    getMethod() {
      return Promise.resolve({
        input: "oauth" as const,
        label: "Sign in with GitHub",
        providerId: "github-copilot",
        providerName: "Copilot",
      });
    },
  }) as never);

  const session = await manager.start({ authChoice: "github-copilot" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const pending = manager.get(session.id);
  assert.ok(pending);
  assert.equal(pending.state, "pending");
  assert.equal(pending.step.type, "auth_link");

  resolveCompletion();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const completed = manager.get(session.id);
  assert.ok(completed);
  assert.equal(completed.state, "completed");
});
