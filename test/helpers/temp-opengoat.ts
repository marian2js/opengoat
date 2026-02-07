import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenGoatPaths } from "../../src/core/domain/opengoat-paths.js";
import type { OpenGoatPathsProvider } from "../../src/core/ports/paths-provider.port.js";

export class TestPathsProvider implements OpenGoatPathsProvider {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public getPaths(): OpenGoatPaths {
    return {
      homeDir: this.root,
      workspacesDir: path.join(this.root, "workspaces"),
      agentsDir: path.join(this.root, "agents"),
      skillsDir: path.join(this.root, "skills"),
      providersDir: path.join(this.root, "providers"),
      runsDir: path.join(this.root, "runs"),
      globalConfigJsonPath: path.join(this.root, "config.json"),
      globalConfigMarkdownPath: path.join(this.root, "CONFIG.md"),
      agentsIndexJsonPath: path.join(this.root, "agents.json")
    };
  }
}

export async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempDir(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}
