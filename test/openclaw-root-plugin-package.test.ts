import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("openclaw root plugin package metadata", () => {
  it("exposes openclaw.extensions from the repository root package", async () => {
    const raw = await readFile(path.join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as {
      name?: unknown;
      openclaw?: { extensions?: unknown };
      files?: unknown;
    };

    expect(pkg.name).toBe("@opengoat/openclaw-plugin-pack");
    expect(pkg.openclaw?.extensions).toEqual(["./index.ts"]);
    expect(pkg.files).toEqual([
      "index.ts",
      "openclaw.plugin.json",
      "packages/openclaw-plugin/index.ts",
      "packages/openclaw-plugin/openclaw.plugin.json",
      "packages/openclaw-plugin/src/**/*.ts",
      "!packages/openclaw-plugin/src/**/*.test.ts",
      "packages/core/src/**/*.ts",
      "!packages/core/src/**/*.test.ts",
      "packages/core/src/core/templates/assets/**/*.md",
    ]);
  });

  it("ships a valid root plugin manifest", async () => {
    const manifestPath = path.join(rootDir, "openclaw.plugin.json");
    await expect(access(manifestPath, constants.F_OK)).resolves.toBeUndefined();

    const raw = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
      configSchema?: unknown;
      uiHints?: unknown;
    };

    expect(manifest.id).toBe("openclaw-plugin-pack");
    expect(typeof manifest.name).toBe("string");
    expect(typeof manifest.description).toBe("string");
    expect(manifest.configSchema).toBeTruthy();
    expect(manifest.uiHints).toBeTruthy();
  });

  it("exports an OpenClaw plugin entrypoint from root index.ts", async () => {
    const module = (await import(
      pathToFileURL(path.join(rootDir, "index.ts")).href
    )) as {
      default?: {
        id?: unknown;
        register?: unknown;
      };
    };

    expect(module.default?.id).toBe("openclaw-plugin-pack");
    expect(typeof module.default?.register).toBe("function");
  });
});
