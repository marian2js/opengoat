import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeOpenGoatPathsProvider, NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";

describe("NodePathPort", () => {
  it("joins path segments", () => {
    const port = new NodePathPort();
    expect(port.join("a", "b", "c")).toBe(path.join("a", "b", "c"));
  });
});

describe("NodeOpenGoatPathsProvider", () => {
  const originalHome = process.env.OPENGOAT_HOME;

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.OPENGOAT_HOME;
      return;
    }

    process.env.OPENGOAT_HOME = originalHome;
  });

  it("uses ~/.opengoat when OPENGOAT_HOME is unset", () => {
    delete process.env.OPENGOAT_HOME;

    const provider = new NodeOpenGoatPathsProvider();
    const paths = provider.getPaths();

    expect(paths.homeDir).toBe(path.join(os.homedir(), ".opengoat"));
    expect(paths.workspacesDir).toBe(path.join(paths.homeDir, "workspaces"));
    expect(paths.organizationDir).toBe(path.join(paths.homeDir, "organization"));
  });

  it("uses OPENGOAT_HOME override and expands tilde", () => {
    process.env.OPENGOAT_HOME = "~/.local/opengoat";

    const provider = new NodeOpenGoatPathsProvider();
    const paths = provider.getPaths();

    expect(paths.homeDir).toBe(path.join(os.homedir(), ".local", "opengoat"));
    expect(paths.globalConfigJsonPath).toBe(path.join(paths.homeDir, "config.json"));
  });

  it("resolves relative OPENGOAT_HOME paths", () => {
    process.env.OPENGOAT_HOME = "./tmp/opengoat-home";

    const provider = new NodeOpenGoatPathsProvider();
    const paths = provider.getPaths();

    expect(paths.homeDir).toBe(path.resolve("./tmp/opengoat-home"));
  });
});
