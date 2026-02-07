import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { PathPort } from "../../ports/path.port.js";

export interface OpenClawCompatPaths {
  stateDir: string;
  configPath: string;
  extensionsDir: string;
}

export interface OpenClawPluginRecord {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  source: string;
  origin: "bundled" | "global" | "workspace" | "config";
  enabled: boolean;
  status: "loaded" | "disabled" | "error";
  error?: string;
  channelIds?: string[];
  providerIds?: string[];
  toolNames?: string[];
  cliCommands?: string[];
  commands?: string[];
}

export interface OpenClawPluginDiagnostic {
  level: "warn" | "error";
  message: string;
  pluginId?: string;
  source?: string;
}

export interface OpenClawPluginListReport {
  workspaceDir?: string;
  plugins: OpenClawPluginRecord[];
  diagnostics: OpenClawPluginDiagnostic[];
}

export interface OpenClawPluginInfoRecord extends OpenClawPluginRecord {
  configSchema?: boolean;
  configJsonSchema?: Record<string, unknown>;
}

export interface OpenClawPluginManifest {
  id: string;
  configSchema?: Record<string, unknown>;
  kind?: string;
  channels?: string[];
  providers?: string[];
  skills?: string[];
  name?: string;
  description?: string;
  version?: string;
}

export interface PluginInstallRequest {
  spec: string;
  link?: boolean;
}

export interface PluginInstallResult {
  code: number;
  stdout: string;
  stderr: string;
  installedPluginId?: string;
}

export function resolveOpenClawCompatPaths(paths: OpenGoatPaths, pathPort: PathPort): OpenClawCompatPaths {
  const stateDir = pathPort.join(paths.homeDir, "openclaw-compat");
  return {
    stateDir,
    configPath: pathPort.join(stateDir, "openclaw.json"),
    extensionsDir: pathPort.join(stateDir, "extensions")
  };
}
