import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";

const BUNDLED_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "bundled",
);
const MARKETING_SOURCE = path.join(BUNDLED_DIR, "marketing");
const PERSONAS_SOURCE = path.join(BUNDLED_DIR, "personas");
const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "vendor-manifest.json",
);
const VERSION_MARKER = ".bundled-skills-version";

export interface BundledSkillProvisionResult {
  provisioned: boolean;
  createdPaths: string[];
  skippedPaths: string[];
}

interface BundledSkillProvisionerDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
}

export class BundledSkillProvisioner {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private manifestHashCache: string | null = null;

  public constructor(deps: BundledSkillProvisionerDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
  }

  public async provisionBundledSkills(
    workspaceDir: string,
  ): Promise<BundledSkillProvisionResult> {
    if (process.env.OPENGOAT_SKIP_BUNDLED_SKILLS === "1") {
      return { provisioned: false, createdPaths: [], skippedPaths: [workspaceDir] };
    }

    const currentHash = await this.computeManifestHash();
    const shouldProvision = await this.shouldProvisionSkills(
      workspaceDir,
      currentHash,
    );

    if (!shouldProvision) {
      return { provisioned: false, createdPaths: [], skippedPaths: [workspaceDir] };
    }

    const createdPaths: string[] = [];

    const marketingTarget = this.pathPort.join(workspaceDir, "skills", "marketing");
    const personasTarget = this.pathPort.join(workspaceDir, "skills", "personas");

    await this.fileSystem.ensureDir(marketingTarget);
    await this.fileSystem.ensureDir(personasTarget);

    const marketingSkills = await this.listSkillDirectories(MARKETING_SOURCE);
    for (const skillDir of marketingSkills) {
      const source = path.join(MARKETING_SOURCE, skillDir);
      const target = this.pathPort.join(marketingTarget, skillDir);
      await this.fileSystem.copyDir(source, target);
      createdPaths.push(target);
    }

    const personaSkills = await this.listSkillDirectories(PERSONAS_SOURCE);
    for (const skillDir of personaSkills) {
      const source = path.join(PERSONAS_SOURCE, skillDir);
      const target = this.pathPort.join(personasTarget, skillDir);
      await this.fileSystem.copyDir(source, target);
      createdPaths.push(target);
    }

    const markerPath = this.pathPort.join(workspaceDir, VERSION_MARKER);
    await this.fileSystem.writeFile(markerPath, currentHash);
    createdPaths.push(markerPath);

    return { provisioned: true, createdPaths, skippedPaths: [] };
  }

  public async computeManifestHash(): Promise<string> {
    if (this.manifestHashCache) {
      return this.manifestHashCache;
    }
    const content = await this.fileSystem.readFile(MANIFEST_PATH);
    const hash = createHash("sha256").update(content).digest("hex");
    this.manifestHashCache = hash;
    return hash;
  }

  private async shouldProvisionSkills(
    workspaceDir: string,
    currentHash: string,
  ): Promise<boolean> {
    const markerPath = this.pathPort.join(workspaceDir, VERSION_MARKER);
    const exists = await this.fileSystem.exists(markerPath);
    if (!exists) {
      return true;
    }
    const storedHash = (await this.fileSystem.readFile(markerPath)).trim();
    return storedHash !== currentHash;
  }

  private async listSkillDirectories(sourceDir: string): Promise<string[]> {
    const entries = await this.fileSystem.listDirectories(sourceDir);
    return entries.filter(
      (entry) => entry !== "." && entry !== ".." && !entry.startsWith("."),
    );
  }
}
