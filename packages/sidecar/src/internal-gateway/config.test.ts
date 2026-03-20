import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { writeEmbeddedGatewayConfig } from "./config.ts";

interface TestGatewayConfig {
  agents?: {
    defaults?: {
      model?: {
        primary: string;
      };
    };
    list: Record<string, unknown>[];
  };
  auth?: {
    order: {
      "openai-codex": string[];
    };
  };
  discovery: { mdns: { mode: string }; wideArea: { enabled: boolean } };
  gateway: {
    auth: { mode: string; token: string };
    bind: string;
    controlUi: { enabled: boolean };
    port: number;
  };
  logging: { file: string; level: string };
}

void describe("writeEmbeddedGatewayConfig", () => {
  void it("writes a local-only config with app-owned logging", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "opengoat-gateway-config-"));
    const paths = {
      configDir: rootDir,
      configPath: join(rootDir, "runtime.json"),
      deviceIdentityPath: join(rootDir, "identity", "device.json"),
      logsDir: join(rootDir, "logs"),
      metadataPath: join(rootDir, "metadata.json"),
      oauthDir: join(rootDir, "oauth"),
      rootDir,
      stateDir: join(rootDir, "state"),
      tokenPath: join(rootDir, "gateway-token"),
      workspacesDir: join(rootDir, "workspaces"),
    };

    await writeEmbeddedGatewayConfig({
      paths,
      port: 19111,
      token: "secret-token",
    });

    const raw = await readFile(paths.configPath, "utf8");
    const config = JSON.parse(raw) as TestGatewayConfig;

    assert.deepEqual(config.discovery, {
      mdns: { mode: "off" },
      wideArea: { enabled: false },
    });
    assert.deepEqual(config.gateway, {
      auth: { mode: "token", token: "secret-token" },
      bind: "loopback",
      controlUi: { enabled: false },
      port: 19111,
    });
    assert.deepEqual(config.logging, {
      file: join(paths.logsDir, "gateway.log"),
      level: "info",
    });
    // The config writer no longer manages the agents section;
    // agent metadata is handled by the metadata store instead.
    assert.equal(config.agents, undefined);
  });

  void it("preserves existing runtime config while ensuring the default agent entry", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "opengoat-gateway-config-"));
    const paths = {
      configDir: rootDir,
      configPath: join(rootDir, "runtime.json"),
      deviceIdentityPath: join(rootDir, "identity", "device.json"),
      logsDir: join(rootDir, "logs"),
      metadataPath: join(rootDir, "metadata.json"),
      oauthDir: join(rootDir, "oauth"),
      rootDir,
      stateDir: join(rootDir, "state"),
      tokenPath: join(rootDir, "gateway-token"),
      workspacesDir: join(rootDir, "workspaces"),
    };

    await writeFile(
      paths.configPath,
      `${JSON.stringify(
        {
          agents: {
            defaults: {
              model: {
                primary: "openai-codex/gpt-5.4",
              },
            },
            list: [
              {
                default: true,
                id: "main",
                name: "Old Main",
                workspace: "/tmp/legacy-main",
              },
              {
                id: "research",
                name: "Research",
                workspace: "/tmp/research",
              },
            ],
          },
          auth: {
            order: {
              "openai-codex": ["openai-codex:default"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeEmbeddedGatewayConfig({
      paths,
      port: 19111,
      token: "secret-token",
    });

    const raw = await readFile(paths.configPath, "utf8");
    const config = JSON.parse(raw) as TestGatewayConfig;

    // The config writer preserves existing top-level keys it doesn't manage
    // (agents, auth) via the spread of the existing payload.
    assert.ok(config.agents);
    assert.equal(config.agents.defaults?.model?.primary, "openai-codex/gpt-5.4");
    assert.deepEqual(config.auth?.order["openai-codex"], ["openai-codex:default"]);
    // The agents list is preserved as-is from the existing config
    assert.deepEqual(config.agents.list, [
      {
        default: true,
        id: "main",
        name: "Old Main",
        workspace: "/tmp/legacy-main",
      },
      {
        id: "research",
        name: "Research",
        workspace: "/tmp/research",
      },
    ]);
  });
});
