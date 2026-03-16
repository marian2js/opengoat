import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type {
  ProjectAgentDescriptor,
  ProjectCreationResult,
  ProjectDescriptor,
} from "../domain/project.js";

interface ProjectServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  nowIso: () => string;
}

interface StoredProjectConfig {
  schemaVersion: number;
  id: string;
  displayName: string;
  sourceUrl: string;
  sourceHost: string;
  sourceOrigin: string;
  createdAt: string;
  updatedAt: string;
  agents: {
    cmo: {
      agentId: string;
      providerId: "openclaw";
      role: "CMO";
    };
  };
}

interface ResolvedProjectUrl {
  canonicalUrl: string;
  sourceHost: string;
  sourceOrigin: string;
  slugCandidate: string;
  displayName: string;
}

const PROJECT_CONFIG_FILE_NAME = "project.json";
const PROJECT_AGENT_ROLE_ID = "cmo";
const PROJECT_AGENT_ROLE = "CMO";
const COMMON_MULTI_PART_TLDS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "net",
  "org",
]);
const NOISY_SUBDOMAIN_LABELS = new Set([
  "app",
  "beta",
  "blog",
  "dashboard",
  "docs",
  "help",
  "portal",
  "staging",
  "studio",
  "www",
]);
const SPLITTABLE_SUFFIXES = [
  "project",
  "studio",
  "cloud",
  "labs",
  "tech",
  "shop",
  "site",
  "team",
  "work",
  "app",
  "api",
  "bot",
  "crm",
  "cms",
  "dev",
  "hub",
  "ops",
  "web",
  "ai",
];

export class ProjectService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly nowIso: () => string;

  public constructor(deps: ProjectServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.nowIso = deps.nowIso;
  }

  public async ensureProject(
    paths: OpenGoatPaths,
    rawUrl: string,
  ): Promise<ProjectCreationResult> {
    const resolved = resolveProjectUrl(rawUrl);
    const createdPaths: string[] = [];
    const skippedPaths: string[] = [];

    await this.fileSystem.ensureDir(paths.projectsDir);

    const existingProjects = await this.listStoredProjects(paths);
    const matchingProject = existingProjects.find(
      (project) => project.sourceOrigin === resolved.sourceOrigin,
    );

    const projectId =
      matchingProject?.id ??
      resolveAvailableProjectId(
        resolved.slugCandidate,
        existingProjects.map((project) => project.id),
      );
    const descriptor = this.toProjectDescriptor(paths, matchingProject ?? {
      schemaVersion: 1,
      id: projectId,
      displayName: resolved.displayName,
      sourceUrl: resolved.canonicalUrl,
      sourceHost: resolved.sourceHost,
      sourceOrigin: resolved.sourceOrigin,
      createdAt: this.nowIso(),
      updatedAt: this.nowIso(),
      agents: {
        cmo: {
          agentId: buildProjectAgentId(projectId),
          providerId: "openclaw",
          role: PROJECT_AGENT_ROLE,
        },
      },
    });

    const configExists = await this.fileSystem.exists(descriptor.configPath);
    const projectDirExists = await this.fileSystem.exists(descriptor.rootDir);
    const workspaceExists = await this.fileSystem.exists(
      descriptor.cmoAgent.workspaceDir,
    );
    const agentDirExists = await this.fileSystem.exists(
      descriptor.cmoAgent.internalConfigDir,
    );
    const alreadyExisted =
      configExists || projectDirExists || workspaceExists || agentDirExists;

    await this.ensureDir(
      descriptor.rootDir,
      createdPaths,
      skippedPaths,
    );
    await this.ensureDir(
      descriptor.cmoAgent.workspaceDir,
      createdPaths,
      skippedPaths,
    );
    await this.ensureDir(
      descriptor.cmoAgent.internalConfigDir,
      createdPaths,
      skippedPaths,
    );

    const config = this.toStoredProjectConfig(descriptor);
    if (!configExists) {
      await this.fileSystem.writeFile(
        descriptor.configPath,
        `${JSON.stringify(config, null, 2)}\n`,
      );
      createdPaths.push(descriptor.configPath);
    } else {
      skippedPaths.push(descriptor.configPath);
    }

    return {
      project: descriptor,
      alreadyExisted,
      createdPaths,
      skippedPaths,
    };
  }

  public async listProjects(paths: OpenGoatPaths): Promise<ProjectDescriptor[]> {
    const projects = await this.listStoredProjects(paths);
    return projects
      .map((project) => this.toProjectDescriptor(paths, project))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public async listProjectAgents(
    paths: OpenGoatPaths,
  ): Promise<ProjectAgentDescriptor[]> {
    const projects = await this.listProjects(paths);
    return projects
      .map((project) => project.cmoAgent)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private async listStoredProjects(
    paths: OpenGoatPaths,
  ): Promise<StoredProjectConfig[]> {
    if (!(await this.fileSystem.exists(paths.projectsDir))) {
      return [];
    }

    const projectIds = await this.fileSystem.listDirectories(paths.projectsDir);
    const projects: StoredProjectConfig[] = [];

    for (const projectId of projectIds) {
      const configPath = this.pathPort.join(
        paths.projectsDir,
        projectId,
        PROJECT_CONFIG_FILE_NAME,
      );
      const config = await this.readJsonIfPresent<StoredProjectConfig>(
        configPath,
      );
      if (isStoredProjectConfig(config)) {
        projects.push(config);
      }
    }

    return projects;
  }

  private toProjectDescriptor(
    paths: OpenGoatPaths,
    config: StoredProjectConfig,
  ): ProjectDescriptor {
    const rootDir = this.pathPort.join(paths.projectsDir, config.id);
    const cmoAgent = this.toProjectAgentDescriptor(rootDir, config);
    return {
      id: config.id,
      displayName: config.displayName,
      sourceUrl: config.sourceUrl,
      sourceHost: config.sourceHost,
      rootDir,
      configPath: this.pathPort.join(rootDir, PROJECT_CONFIG_FILE_NAME),
      cmoAgent,
    };
  }

  private toProjectAgentDescriptor(
    projectRootDir: string,
    config: StoredProjectConfig,
  ): ProjectAgentDescriptor {
    return {
      id: config.agents.cmo.agentId,
      displayName: `${config.displayName} ${PROJECT_AGENT_ROLE}`,
      role: config.agents.cmo.role,
      roleId: PROJECT_AGENT_ROLE_ID,
      providerId: config.agents.cmo.providerId,
      workspaceDir: this.pathPort.join(projectRootDir, PROJECT_AGENT_ROLE_ID),
      internalConfigDir: this.pathPort.join(
        projectRootDir,
        "agents",
        PROJECT_AGENT_ROLE_ID,
      ),
    };
  }

  private toStoredProjectConfig(
    project: ProjectDescriptor,
  ): StoredProjectConfig {
    return {
      schemaVersion: 1,
      id: project.id,
      displayName: project.displayName,
      sourceUrl: project.sourceUrl,
      sourceHost: project.sourceHost,
      sourceOrigin: resolveSourceOrigin(project.sourceUrl),
      createdAt: this.nowIso(),
      updatedAt: this.nowIso(),
      agents: {
        cmo: {
          agentId: project.cmoAgent.id,
          providerId: project.cmoAgent.providerId,
          role: PROJECT_AGENT_ROLE,
        },
      },
    };
  }

  private async ensureDir(
    dirPath: string,
    createdPaths: string[],
    skippedPaths: string[],
  ): Promise<void> {
    const exists = await this.fileSystem.exists(dirPath);
    await this.fileSystem.ensureDir(dirPath);
    if (exists) {
      skippedPaths.push(dirPath);
      return;
    }
    createdPaths.push(dirPath);
  }

  private async readJsonIfPresent<T>(filePath: string): Promise<T | null> {
    if (!(await this.fileSystem.exists(filePath))) {
      return null;
    }
    try {
      const raw = await this.fileSystem.readFile(filePath);
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

function resolveProjectUrl(rawUrl: string): ResolvedProjectUrl {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Project URL cannot be empty.");
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid project URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Project URL must use http or https.");
  }
  if (!parsed.hostname.trim()) {
    throw new Error("Project URL must include a hostname.");
  }

  parsed.hash = "";
  const sourceHost = normalizeHost(parsed.hostname);
  const slugCandidate = resolveProjectSlugCandidate(parsed);
  return {
    canonicalUrl: parsed.toString(),
    sourceHost,
    sourceOrigin: `${parsed.protocol}//${parsed.host.toLowerCase()}`,
    slugCandidate,
    displayName: slugToDisplayName(slugCandidate),
  };
}

function resolveProjectSlugCandidate(parsed: URL): string {
  const normalizedHost = normalizeHost(parsed.hostname);
  if (!normalizedHost) {
    return "project";
  }

  if (normalizedHost === "localhost" || normalizedHost.includes(":")) {
    return normalizeSlug(`${normalizedHost}${parsed.port ? `-${parsed.port}` : ""}`);
  }

  const labels = normalizedHost.split(".").filter(Boolean);
  const baseLabels = stripPublicSuffix(labels);
  const filteredLabels =
    baseLabels.length > 1
      ? baseLabels.filter((label, index) => {
          return index > 0 || !NOISY_SUBDOMAIN_LABELS.has(label);
        })
      : baseLabels;
  const joined = filteredLabels.join("-");
  const split = joined
    .split("-")
    .flatMap((segment) => splitCompactSegment(segment))
    .join("-");
  const normalized = normalizeSlug(split);
  return normalized || "project";
}

function stripPublicSuffix(labels: string[]): string[] {
  if (labels.length <= 1) {
    return labels;
  }

  if (
    labels.length >= 3 &&
    labels[labels.length - 1]?.length === 2 &&
    COMMON_MULTI_PART_TLDS.has(labels[labels.length - 2] ?? "")
  ) {
    return labels.slice(0, -2);
  }

  return labels.slice(0, -1);
}

function splitCompactSegment(segment: string): string[] {
  const normalized = segment
    .trim()
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1-$2")
    .replace(/([0-9])([a-z])/g, "$1-$2");
  const parts = normalized.split("-").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    let split = false;
    for (const suffix of SPLITTABLE_SUFFIXES) {
      if (
        part.length > suffix.length + 1 &&
        part.endsWith(suffix)
      ) {
        resolved.push(part.slice(0, -suffix.length), suffix);
        split = true;
        break;
      }
    }
    if (!split) {
      resolved.push(part);
    }
  }

  return resolved;
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugToDisplayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveAvailableProjectId(
  slugCandidate: string,
  existingIds: string[],
): string {
  const normalizedCandidate = normalizeSlug(slugCandidate) || "project";
  const existing = new Set(existingIds.map((id) => normalizeSlug(id)));
  if (!existing.has(normalizedCandidate)) {
    return normalizedCandidate;
  }

  let suffix = 2;
  while (existing.has(`${normalizedCandidate}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedCandidate}-${suffix}`;
}

function buildProjectAgentId(projectId: string): string {
  return `${projectId}-${PROJECT_AGENT_ROLE_ID}`;
}

function resolveSourceOrigin(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    return `${parsed.protocol}//${parsed.host.toLowerCase()}`;
  } catch {
    return sourceUrl.trim().toLowerCase();
  }
}

function isStoredProjectConfig(value: unknown): value is StoredProjectConfig {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<StoredProjectConfig>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.sourceUrl === "string" &&
    typeof candidate.sourceHost === "string" &&
    typeof candidate.sourceOrigin === "string" &&
    !!candidate.agents &&
    typeof candidate.agents.cmo?.agentId === "string" &&
    candidate.agents.cmo?.providerId === "openclaw"
  );
}
