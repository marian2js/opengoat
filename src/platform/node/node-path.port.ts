import os from "node:os";
import path from "node:path";
import type { OpenGoatPaths } from "../../core/domain/opengoat-paths.js";
import type { PathPort } from "../../core/ports/path.port.js";
import type { OpenGoatPathsProvider } from "../../core/ports/paths-provider.port.js";

export class NodePathPort implements PathPort {
  public join(...segments: string[]): string {
    return path.join(...segments);
  }
}

export class NodeOpenGoatPathsProvider implements OpenGoatPathsProvider {
  public getPaths(): OpenGoatPaths {
    const homeDir = resolveOpenGoatHomeDir();
    return {
      homeDir,
      workspacesDir: path.join(homeDir, "workspaces"),
      agentsDir: path.join(homeDir, "agents"),
      skillsDir: path.join(homeDir, "skills"),
      providersDir: path.join(homeDir, "providers"),
      runsDir: path.join(homeDir, "runs"),
      globalConfigJsonPath: path.join(homeDir, "config.json"),
      globalConfigMarkdownPath: path.join(homeDir, "CONFIG.md"),
      agentsIndexJsonPath: path.join(homeDir, "agents.json")
    };
  }
}

function resolveOpenGoatHomeDir(): string {
  const override = process.env.OPENGOAT_HOME?.trim();
  if (override) {
    return path.resolve(expandTilde(override));
  }

  return path.join(os.homedir(), ".opengoat");
}

function expandTilde(value: string): string {
  if (!value.startsWith("~")) {
    return value;
  }

  if (value === "~") {
    return os.homedir();
  }

  return path.join(os.homedir(), value.slice(2));
}
