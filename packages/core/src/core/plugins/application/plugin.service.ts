import fsPath from "node:path";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { CommandRunResult, CommandRunnerPort } from "../../ports/command-runner.port.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import {
  type OpenClawCompatPaths,
  type OpenClawPluginInfoRecord,
  type OpenClawPluginListReport,
  type OpenClawPluginManifest,
  type PluginInstallRequest,
  type PluginInstallResult,
  resolveOpenClawCompatPaths
} from "../domain/openclaw-compat.js";

interface PluginServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  commandRunner?: CommandRunnerPort;
  openClawCommand?: string;
}

interface OpenClawConfigShape {
  plugins?: {
    load?: {
      paths?: string[];
    };
    entries?: Record<string, { enabled?: boolean }>;
  };
}

export class PluginService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly commandRunner?: CommandRunnerPort;
  private readonly openClawCommand: string;

  public constructor(deps: PluginServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.commandRunner = deps.commandRunner;
    this.openClawCommand = deps.openClawCommand?.trim() || process.env.OPENGOAT_OPENCLAW_CMD?.trim() || "openclaw";
  }

  public async listPlugins(
    paths: OpenGoatPaths,
    options: { enabledOnly?: boolean; verbose?: boolean; includeBundled?: boolean } = {}
  ): Promise<OpenClawPluginListReport> {
    const args = ["plugins", "list", "--json"];
    if (options.enabledOnly) {
      args.push("--enabled");
    }
    if (options.verbose) {
      args.push("--verbose");
    }
    const result = await this.runOpenClaw(paths, args);
    const parsed = parseJsonPayload<OpenClawPluginListReport>(result.stdout);
    const plugins = options.includeBundled
      ? parsed.plugins
      : parsed.plugins.filter((plugin) => plugin.origin !== "bundled");

    return {
      workspaceDir: parsed.workspaceDir,
      diagnostics: parsed.diagnostics ?? [],
      plugins
    };
  }

  public async getPluginInfo(paths: OpenGoatPaths, pluginId: string): Promise<OpenClawPluginInfoRecord> {
    const result = await this.runOpenClaw(paths, ["plugins", "info", pluginId, "--json"]);
    return parseJsonPayload<OpenClawPluginInfoRecord>(result.stdout);
  }

  public async installPlugin(paths: OpenGoatPaths, request: PluginInstallRequest): Promise<PluginInstallResult> {
    const spec = request.spec.trim();
    if (!spec) {
      throw new Error("Plugin spec/path cannot be empty.");
    }

    const before = await this.listPlugins(paths, { includeBundled: true });
    const args = ["plugins", "install"];
    if (request.link) {
      args.push("--link");
    }
    args.push(spec);
    const run = await this.runOpenClaw(paths, args, { allowFailure: true });
    if (run.code !== 0) {
      throw new Error(composeOpenClawError("Plugin installation failed.", run));
    }

    const after = await this.listPlugins(paths, { includeBundled: true });
    const installedPluginId = resolveInstalledPluginId(before.plugins.map((entry) => entry.id), after.plugins.map((entry) => entry.id), spec);

    return {
      code: run.code,
      stdout: run.stdout,
      stderr: run.stderr,
      installedPluginId
    };
  }

  public async enablePlugin(paths: OpenGoatPaths, pluginId: string): Promise<void> {
    await this.runOpenClaw(paths, ["plugins", "enable", pluginId], { allowFailure: false });
  }

  public async disablePlugin(paths: OpenGoatPaths, pluginId: string): Promise<void> {
    await this.runOpenClaw(paths, ["plugins", "disable", pluginId], { allowFailure: false });
  }

  public async doctor(paths: OpenGoatPaths): Promise<CommandRunResult> {
    return this.runOpenClaw(paths, ["plugins", "doctor"], { allowFailure: true });
  }

  public async resolvePluginSkillDirectories(paths: OpenGoatPaths): Promise<string[]> {
    const compat = resolveOpenClawCompatPaths(paths, this.pathPort);
    await this.fileSystem.ensureDir(compat.stateDir);
    await this.fileSystem.ensureDir(compat.extensionsDir);

    const pluginRoots = new Set<string>();
    const extensionDirs = await this.fileSystem.listDirectories(compat.extensionsDir);
    for (const entry of extensionDirs) {
      pluginRoots.add(this.pathPort.join(compat.extensionsDir, entry));
    }

    const config = await this.readCompatConfig(compat);
    const configPaths = config.plugins?.load?.paths ?? [];
    for (const rawPath of configPaths) {
      const trimmed = rawPath.trim();
      if (!trimmed) {
        continue;
      }
      const root = resolvePathWithHome(trimmed, compat.stateDir);
      const exists = await this.fileSystem.exists(root);
      if (!exists) {
        continue;
      }
      pluginRoots.add(root);
    }

    const skillDirs = new Set<string>();
    for (const root of pluginRoots) {
      const manifestPath = this.pathPort.join(root, "openclaw.plugin.json");
      const manifestExists = await this.fileSystem.exists(manifestPath);
      let manifest: OpenClawPluginManifest | undefined;
      if (manifestExists) {
        try {
          manifest = JSON.parse(await this.fileSystem.readFile(manifestPath)) as OpenClawPluginManifest;
        } catch {
          manifest = undefined;
        }
      }

      const manifestSkillDirs = manifest?.skills?.map((entry) => this.pathPort.join(root, entry)) ?? [];
      for (const dir of manifestSkillDirs) {
        if (await this.fileSystem.exists(dir)) {
          skillDirs.add(dir);
        }
      }

      const defaultSkillsDir = this.pathPort.join(root, "skills");
      if (await this.fileSystem.exists(defaultSkillsDir)) {
        skillDirs.add(defaultSkillsDir);
      }
    }

    return [...skillDirs].sort((left, right) => left.localeCompare(right));
  }

  private async readCompatConfig(compat: OpenClawCompatPaths): Promise<OpenClawConfigShape> {
    const exists = await this.fileSystem.exists(compat.configPath);
    if (!exists) {
      return {};
    }

    try {
      return JSON.parse(await this.fileSystem.readFile(compat.configPath)) as OpenClawConfigShape;
    } catch {
      return {};
    }
  }

  private async runOpenClaw(
    paths: OpenGoatPaths,
    args: string[],
    options: { allowFailure?: boolean } = {}
  ): Promise<CommandRunResult> {
    if (!this.commandRunner) {
      throw new Error("Plugin runtime is unavailable: command runner was not configured.");
    }

    const compat = resolveOpenClawCompatPaths(paths, this.pathPort);
    await this.fileSystem.ensureDir(compat.stateDir);
    await this.fileSystem.ensureDir(compat.extensionsDir);

    let result: CommandRunResult;
    try {
      result = await this.commandRunner.run({
        command: this.openClawCommand,
        args,
        cwd: compat.stateDir,
        env: {
          ...process.env,
          OPENCLAW_STATE_DIR: compat.stateDir,
          NO_COLOR: "1",
          FORCE_COLOR: "0"
        }
      });
    } catch (error) {
      if (isCommandMissing(error)) {
        throw new Error(
          `OpenClaw CLI command not found: ${this.openClawCommand}. Install OpenClaw or set OPENGOAT_OPENCLAW_CMD.`
        );
      }
      throw error;
    }

    if (!options.allowFailure && result.code !== 0) {
      throw new Error(composeOpenClawError(`OpenClaw command failed: ${this.openClawCommand} ${args.join(" ")}`, result));
    }

    return result;
  }
}

function parseJsonPayload<T>(value: string): T {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("OpenClaw returned empty JSON payload.");
  }

  const direct = tryParseJson<T>(trimmed);
  if (direct) {
    return direct;
  }

  const object = extractJsonObject(trimmed);
  const parsed = object ? tryParseJson<T>(object) : null;
  if (parsed) {
    return parsed;
  }

  throw new Error("Failed to parse OpenClaw JSON payload.");
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractJsonObject(value: string): string | null {
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first < 0 || last <= first) {
    return null;
  }
  return value.slice(first, last + 1);
}

function composeOpenClawError(prefix: string, result: CommandRunResult): string {
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const details = stderr || stdout || `exit code ${result.code}`;
  return `${prefix} ${details}`;
}

function resolveInstalledPluginId(previousIds: string[], nextIds: string[], spec: string): string | undefined {
  const before = new Set(previousIds);
  const added = nextIds.filter((id) => !before.has(id));
  if (added.length > 0) {
    return added[0];
  }

  const guessed = normalizePluginIdFromSpec(spec);
  return nextIds.find((id) => id === guessed) ?? guessed;
}

function normalizePluginIdFromSpec(spec: string): string {
  const trimmed = spec.trim();
  const basename = fsPath.basename(trimmed);
  const normalized = basename.includes("@") ? basename : trimmed;
  const lastSegment = normalized.includes("/") ? (normalized.split("/").pop() ?? normalized) : normalized;
  const withoutExt = lastSegment.replace(/\.(zip|tgz|tar\.gz|js|mjs|cjs|ts|mts|cts)$/i, "");
  return withoutExt.toLowerCase().replace(/[^a-z0-9-_.]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolvePathWithHome(value: string, baseDir: string): string {
  if (!value.startsWith("~")) {
    return fsPath.isAbsolute(value) ? value : fsPath.resolve(baseDir, value);
  }

  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (value === "~") {
    return home;
  }

  return fsPath.join(home, value.slice(2));
}

function isCommandMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT";
}
