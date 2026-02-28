import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MANAGED_OPENCLAW_PLUGIN_ID,
  hasCoreFsToolsDenied,
  mergeCoreFsToolsDenied,
  mutateManagedOpenClawPluginConfig,
  resolveOpenClawConfigPath,
} from "./openclaw-managed-plugin.js";

describe("openclaw managed plugin config mutation", () => {
  it("injects managed plugin settings and removes missing load paths", () => {
    const existingLoadPath = path.resolve("/tmp/existing-plugin");
    const managedPluginPath = path.resolve("/tmp/opengoat-shared-fs");

    const mutated = mutateManagedOpenClawPluginConfig({
      rootConfig: {
        plugins: {
          load: {
            paths: ["/tmp/missing-plugin", existingLoadPath],
          },
          allow: ["group:core"],
          deny: [MANAGED_OPENCLAW_PLUGIN_ID, "browser"],
          entries: {},
        },
      },
      managedPluginPath,
      opengoatHomeDir: "~/.opengoat",
      existingLoadPathSet: new Set([existingLoadPath, managedPluginPath]),
    });

    const plugins = ((mutated.config.plugins as Record<string, unknown>) ?? {}) as {
      enabled?: boolean;
      load?: { paths?: string[] };
      allow?: string[];
      deny?: string[];
      entries?: Record<string, unknown>;
    };

    expect(mutated.changed).toBe(true);
    expect(mutated.removedMissingLoadPaths).toEqual([
      path.resolve("/tmp/missing-plugin"),
    ]);
    expect(plugins.enabled).toBe(true);
    expect(plugins.load?.paths).toEqual([existingLoadPath, managedPluginPath]);
    expect(plugins.allow).toEqual(["group:core", MANAGED_OPENCLAW_PLUGIN_ID]);
    expect(plugins.deny).toEqual(["browser"]);

    const managedEntry =
      (plugins.entries?.[MANAGED_OPENCLAW_PLUGIN_ID] as Record<string, unknown>) ?? {};
    const managedConfig = (managedEntry.config as Record<string, unknown>) ?? {};
    expect(managedEntry.enabled).toBe(true);
    expect(String(managedConfig.opengoatHomeDir)).toContain(
      path.join("", ".opengoat"),
    );
  });

  it("ensures plugin id is present once in allow list", () => {
    const managedPluginPath = path.resolve("/tmp/opengoat-shared-fs");

    const mutated = mutateManagedOpenClawPluginConfig({
      rootConfig: {
        plugins: {
          load: { paths: [managedPluginPath] },
          allow: [MANAGED_OPENCLAW_PLUGIN_ID, "group:core", MANAGED_OPENCLAW_PLUGIN_ID],
        },
      },
      managedPluginPath,
      opengoatHomeDir: path.resolve("/tmp/.opengoat"),
      existingLoadPathSet: new Set([managedPluginPath]),
    });

    const plugins = (mutated.config.plugins as Record<string, unknown>) ?? {};
    expect(plugins.allow).toEqual([MANAGED_OPENCLAW_PLUGIN_ID, "group:core"]);
  });

  it("does not force a plugins.allow list when none was configured", () => {
    const managedPluginPath = path.resolve("/tmp/opengoat-shared-fs");

    const mutated = mutateManagedOpenClawPluginConfig({
      rootConfig: {
        plugins: {
          load: { paths: [managedPluginPath] },
        },
      },
      managedPluginPath,
      opengoatHomeDir: path.resolve("/tmp/.opengoat"),
      existingLoadPathSet: new Set([managedPluginPath]),
    });

    const plugins = (mutated.config.plugins as Record<string, unknown>) ?? {};
    expect("allow" in plugins).toBe(false);
  });
});

describe("openclaw tool deny helpers", () => {
  it("merges core fs tools into deny list", () => {
    expect(mergeCoreFsToolsDenied(["browser", "READ", "write"]).sort()).toEqual(
      ["browser", "edit", "read", "write"].sort(),
    );
  });

  it("detects when core fs tools are denied", () => {
    expect(
      hasCoreFsToolsDenied({
        tools: {
          deny: ["read", "write", "edit"],
        },
      }),
    ).toBe(true);

    expect(
      hasCoreFsToolsDenied({
        tools: {
          deny: ["read", "write"],
        },
      }),
    ).toBe(false);
  });
});

describe("resolveOpenClawConfigPath", () => {
  it("prefers OPENCLAW_CONFIG_PATH over state directory", () => {
    const resolved = resolveOpenClawConfigPath({
      OPENCLAW_CONFIG_PATH: "~/.openclaw-custom/config.json",
      OPENCLAW_STATE_DIR: "~/.openclaw-state",
    });

    expect(resolved.endsWith(path.join(".openclaw-custom", "config.json"))).toBe(
      true,
    );
  });

  it("uses OPENCLAW_STATE_DIR when config path is not set", () => {
    const resolved = resolveOpenClawConfigPath({
      OPENCLAW_STATE_DIR: "~/.openclaw-state",
    });

    expect(resolved.endsWith(path.join(".openclaw-state", "openclaw.json"))).toBe(
      true,
    );
  });
});
