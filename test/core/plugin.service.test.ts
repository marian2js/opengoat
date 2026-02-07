import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../src/core/domain/opengoat-paths.js";
import type { CommandRunRequest, CommandRunResult, CommandRunnerPort } from "../../src/core/ports/command-runner.port.js";
import { PluginService, resolveOpenClawCompatPaths } from "../../src/core/plugins/index.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
import { TestPathsProvider, createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("PluginService", () => {
  it("lists plugins and filters bundled entries by default", async () => {
    const root = await createTempDir("opengoat-plugin-service-");
    roots.push(root);
    const paths = createPaths(root);

    const runner = new QueueCommandRunner([
      {
        code: 0,
        stdout: [
          "Warning: diagnostics available",
          JSON.stringify({
            workspaceDir: "/tmp/workspace",
            diagnostics: [{ level: "warn", message: "sample warning" }],
            plugins: [
              {
                id: "@openclaw/filesystem",
                source: "bundled",
                origin: "bundled",
                enabled: true,
                status: "loaded"
              },
              {
                id: "my-plugin",
                source: "extensions/my-plugin",
                origin: "workspace",
                enabled: true,
                status: "loaded"
              }
            ]
          })
        ].join("\n"),
        stderr: ""
      }
    ]);

    const service = new PluginService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      commandRunner: runner
    });

    const report = await service.listPlugins(paths);
    expect(report.plugins.map((plugin) => plugin.id)).toEqual(["my-plugin"]);
    expect(report.diagnostics[0]?.message).toBe("sample warning");
  });

  it("installs plugin and returns detected plugin id", async () => {
    const root = await createTempDir("opengoat-plugin-service-");
    roots.push(root);
    const paths = createPaths(root);

    const before = {
      workspaceDir: "/tmp/workspace",
      diagnostics: [],
      plugins: []
    };
    const after = {
      workspaceDir: "/tmp/workspace",
      diagnostics: [],
      plugins: [
        {
          id: "openclaw-plugin-demo",
          source: "extensions/openclaw-plugin-demo",
          origin: "workspace",
          enabled: true,
          status: "loaded"
        }
      ]
    };

    const runner = new QueueCommandRunner([
      { code: 0, stdout: JSON.stringify(before), stderr: "" },
      { code: 0, stdout: "Installed plugin.\n", stderr: "" },
      { code: 0, stdout: JSON.stringify(after), stderr: "" }
    ]);

    const service = new PluginService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      commandRunner: runner
    });

    const result = await service.installPlugin(paths, { spec: "openclaw-plugin-demo" });
    expect(result.code).toBe(0);
    expect(result.installedPluginId).toBe("openclaw-plugin-demo");

    const compatPath = resolveOpenClawCompatPaths(paths, new NodePathPort()).stateDir;
    expect(runner.requests[0]?.env?.OPENCLAW_STATE_DIR).toBe(compatPath);
  });

  it("resolves plugin skill directories from installed and linked plugins", async () => {
    const root = await createTempDir("opengoat-plugin-service-");
    roots.push(root);
    const fileSystem = new NodeFileSystem();
    const pathPort = new NodePathPort();
    const paths = createPaths(root);
    const compat = resolveOpenClawCompatPaths(paths, pathPort);

    await fileSystem.ensureDir(compat.extensionsDir);

    const installedPluginDir = path.join(compat.extensionsDir, "plugin-installed");
    await fileSystem.ensureDir(path.join(installedPluginDir, "skills"));

    const relativeLinkedDir = path.join(compat.stateDir, "linked-relative");
    await fileSystem.ensureDir(path.join(relativeLinkedDir, "custom-skills"));
    await fileSystem.writeFile(
      path.join(relativeLinkedDir, "openclaw.plugin.json"),
      `${JSON.stringify({ id: "linked-relative", skills: ["custom-skills"] }, null, 2)}\n`
    );

    await fileSystem.writeFile(
      compat.configPath,
      `${JSON.stringify(
        {
          plugins: {
            load: {
              paths: ["./linked-relative"]
            }
          }
        },
        null,
        2
      )}\n`
    );

    const service = new PluginService({
      fileSystem,
      pathPort,
      commandRunner: new QueueCommandRunner([])
    });

    const dirs = await service.resolvePluginSkillDirectories(paths);
    expect(dirs).toEqual(
      [path.join(relativeLinkedDir, "custom-skills"), path.join(installedPluginDir, "skills")].sort((left, right) =>
        left.localeCompare(right)
      )
    );
  });

  it("throws an explicit message when OpenClaw command is missing", async () => {
    const root = await createTempDir("opengoat-plugin-service-");
    roots.push(root);
    const paths = createPaths(root);

    const service = new PluginService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      commandRunner: new MissingCommandRunner()
    });

    await expect(service.listPlugins(paths)).rejects.toThrow("OpenClaw CLI command not found");
  });
});

class QueueCommandRunner implements CommandRunnerPort {
  public readonly requests: CommandRunRequest[] = [];
  private readonly queue: CommandRunResult[];

  public constructor(queue: CommandRunResult[]) {
    this.queue = [...queue];
  }

  public async run(request: CommandRunRequest): Promise<CommandRunResult> {
    this.requests.push(request);
    const next = this.queue.shift();
    if (!next) {
      throw new Error(`Unexpected command: ${request.command} ${request.args.join(" ")}`);
    }
    return next;
  }
}

class MissingCommandRunner implements CommandRunnerPort {
  public async run(): Promise<CommandRunResult> {
    const error = new Error("spawn openclaw ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }
}

function createPaths(root: string): OpenGoatPaths {
  return new TestPathsProvider(root).getPaths();
}
