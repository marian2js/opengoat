import { DEFAULT_AGENT_ID, isDefaultAgentId, normalizeAgentId } from "../../domain/agent-id.js";

export interface AgentDelegationMetadata {
  canReceive: boolean;
  canDelegate: boolean;
}

export type AgentType = "manager" | "individual";

export const BOARD_MANAGER_SKILL_ID = "og-board-manager";
const LEGACY_BOARD_MANAGER_SKILL_ID = "board-manager";
const BOARD_INDIVIDUAL_SKILL_ID = "og-board-individual";
const LEGACY_BOARD_INDIVIDUAL_SKILL_ID = "board-individual";

export interface AgentManifestMetadata {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  reportsTo: string | null;
  discoverable: boolean;
  tags: string[];
  skills: string[];
  delegation: AgentDelegationMetadata;
  priority: number;
}

export interface AgentManifest {
  agentId: string;
  filePath: string;
  workspaceDir: string;
  metadata: AgentManifestMetadata;
  body: string;
  source: "frontmatter" | "config" | "derived";
}

export function isDiscoverableByManager(manifest: AgentManifest): boolean {
  return manifest.metadata.discoverable && manifest.metadata.delegation.canReceive;
}

export function hasManagerSkill(skills: string[]): boolean {
  return skills.some((skill) => {
    const normalized = sanitizeId(skill);
    return (
      normalized === BOARD_MANAGER_SKILL_ID ||
      normalized === LEGACY_BOARD_MANAGER_SKILL_ID
    );
  });
}

export function isManagerAgent(manifest: AgentManifest): boolean {
  return manifest.metadata.delegation.canDelegate || hasManagerSkill(manifest.metadata.skills);
}

export function isDirectReport(manifest: AgentManifest, managerAgentId: string): boolean {
  const managerId = normalizeAgentId(managerAgentId);
  if (!managerId) {
    return false;
  }
  return (manifest.metadata.reportsTo ?? "") === managerId;
}

interface ParsedFrontMatter {
  data: Partial<AgentManifestMetadata>;
  body: string;
  hasFrontMatter: boolean;
}

const FRONT_MATTER_START = "---";
const DEFAULT_PRIORITY = 50;

export function parseAgentManifestMarkdown(markdown: string): ParsedFrontMatter {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith(`${FRONT_MATTER_START}\n`)) {
    return {
      data: {},
      body: normalized,
      hasFrontMatter: false
    };
  }

  const endMarkerIndex = normalized.indexOf(`\n${FRONT_MATTER_START}\n`, FRONT_MATTER_START.length + 1);
  if (endMarkerIndex < 0) {
    return {
      data: {},
      body: normalized,
      hasFrontMatter: false
    };
  }

  const frontMatter = normalized.slice(FRONT_MATTER_START.length + 1, endMarkerIndex);
  const body = normalized.slice(endMarkerIndex + `\n${FRONT_MATTER_START}\n`.length);
  const lines = frontMatter.split("\n");

  const data: Partial<AgentManifestMetadata> = {};
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]?.trim();
    index += 1;

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();

    if (key === "tags") {
      const parsedTags = parseStringListValue(rawValue, lines, index, sanitizeTag);
      data.tags = parsedTags.values;
      index = parsedTags.nextIndex;
      continue;
    }

    if (key === "skills") {
      const parsedSkills = parseStringListValue(rawValue, lines, index, sanitizeId);
      data.skills = parsedSkills.values;
      index = parsedSkills.nextIndex;
      continue;
    }

    if (key === "delegation") {
      const parsedDelegation = parseDelegation(lines, index);
      data.delegation = parsedDelegation.delegation;
      index = parsedDelegation.nextIndex;
      continue;
    }

    if (key === "priority") {
      const priority = Number.parseInt(unquote(rawValue), 10);
      if (Number.isFinite(priority)) {
        data.priority = priority;
      }
      continue;
    }

    if (key === "discoverable") {
      data.discoverable = parseBoolean(rawValue, true);
      continue;
    }

    if (key === "id") {
      data.id = normalizeAgentId(unquote(rawValue));
      continue;
    }

    if (key === "name") {
      data.name = unquote(rawValue);
      continue;
    }

    if (key === "description") {
      data.description = unquote(rawValue);
      continue;
    }

    if (key === "type") {
      const type = unquote(rawValue).toLowerCase();
      if (type === "manager") {
        data.type = "manager";
      }
      if (type === "individual") {
        data.type = "individual";
      }
      continue;
    }

    if (key === "reportsTo") {
      const value = unquote(rawValue).trim().toLowerCase();
      if (value === "null" || value === "none" || value === "") {
        data.reportsTo = null;
      } else {
        const normalizedReport = normalizeAgentId(value);
        if (normalizedReport) {
          data.reportsTo = normalizedReport;
        }
      }
    }
  }

  return {
    data,
    body,
    hasFrontMatter: true
  };
}

export function normalizeAgentManifestMetadata(params: {
  agentId: string;
  displayName: string;
  metadata?: Partial<AgentManifestMetadata>;
}): AgentManifestMetadata {
  const metadata = params.metadata ?? {};
  const agentId = normalizeAgentId(metadata.id ?? params.agentId) || normalizeAgentId(params.agentId) || "agent";
  const explicitType = metadata.type;
  const inferredType: AgentType =
    explicitType ??
    (metadata.delegation?.canDelegate === true ||
    hasManagerSkill(metadata.skills ?? []) ||
    isDefaultAgentId(agentId)
      ? "manager"
      : "individual");
  const name = metadata.name?.trim() || params.displayName.trim() || agentId;
  const description =
    metadata.description?.trim() ||
    (inferredType === "manager" ? "Manager agent coordinating direct reports." : `Agent ${name}.`);
  const discoverable = metadata.discoverable ?? true;
  const tags = dedupe(metadata.tags ?? []);
  const normalizedSkills = dedupe(
    (metadata.skills ?? [])
      .map((skill) => canonicalizeRoleSkillId(sanitizeId(skill)))
      .filter(Boolean),
  );
  const skills =
    inferredType === "manager" && !hasManagerSkill(normalizedSkills)
      ? dedupe([BOARD_MANAGER_SKILL_ID, ...normalizedSkills])
      : normalizedSkills;
  const delegation = {
    canReceive: metadata.delegation?.canReceive ?? true,
    canDelegate: metadata.delegation?.canDelegate ?? (inferredType === "manager" || hasManagerSkill(skills))
  };
  const type: AgentType = delegation.canDelegate || hasManagerSkill(skills) ? "manager" : inferredType;
  const priority =
    typeof metadata.priority === "number" && Number.isFinite(metadata.priority) ? metadata.priority : DEFAULT_PRIORITY;

  const reportsTo = resolveReportsTo({
    agentId,
    reportsTo: metadata.reportsTo,
    type
  });

  return {
    id: agentId,
    name,
    description,
    type,
    reportsTo,
    discoverable,
    tags,
    skills,
    delegation,
    priority
  };
}

export function formatAgentManifestMarkdown(metadata: AgentManifestMetadata, body: string): string {
  const safeBody = body.startsWith("\n") ? body.slice(1) : body;
  const tagsValue = metadata.tags.join(", ");
  const skillsValue = metadata.skills.join(", ");

  return [
    "---",
    `id: ${metadata.id}`,
    `name: ${metadata.name}`,
    `description: ${metadata.description}`,
    `type: ${metadata.type}`,
    `reportsTo: ${metadata.reportsTo ?? "null"}`,
    `discoverable: ${metadata.discoverable}`,
    `tags: [${tagsValue}]`,
    `skills: [${skillsValue}]`,
    "delegation:",
    `  canReceive: ${metadata.delegation.canReceive}`,
    `  canDelegate: ${metadata.delegation.canDelegate}`,
    `priority: ${metadata.priority}`,
    "---",
    "",
    safeBody.endsWith("\n") ? safeBody.slice(0, -1) : safeBody
  ].join("\n") + "\n";
}

function parseStringListValue(
  rawValue: string,
  lines: string[],
  startIndex: number,
  sanitize: (value: string) => string
): { values: string[]; nextIndex: number } {
  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    const values = rawValue
      .slice(1, -1)
      .split(",")
      .map((value) => sanitize(unquote(value.trim())))
      .filter(Boolean);
    return { values: dedupe(values), nextIndex: startIndex };
  }

  const values: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const current = lines[index];
    if (!current) {
      index += 1;
      continue;
    }

    const trimmed = current.trim();
    if (!trimmed.startsWith("- ")) {
      break;
    }

    const value = sanitize(unquote(trimmed.slice(2).trim()));
    if (value) {
      values.push(value);
    }
    index += 1;
  }

  return {
    values: dedupe(values),
    nextIndex: index
  };
}

function canonicalizeRoleSkillId(skillId: string): string {
  if (skillId === LEGACY_BOARD_MANAGER_SKILL_ID) {
    return BOARD_MANAGER_SKILL_ID;
  }
  if (skillId === LEGACY_BOARD_INDIVIDUAL_SKILL_ID) {
    return BOARD_INDIVIDUAL_SKILL_ID;
  }
  return skillId;
}

function parseDelegation(lines: string[], startIndex: number): {
  delegation: AgentDelegationMetadata;
  nextIndex: number;
} {
  const delegation: AgentDelegationMetadata = {
    canReceive: true,
    canDelegate: false
  };

  let index = startIndex;
  while (index < lines.length) {
    const current = lines[index];
    if (!current) {
      index += 1;
      continue;
    }

    if (!current.startsWith("  ")) {
      break;
    }

    const trimmed = current.trim();
    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      index += 1;
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key === "canReceive") {
      delegation.canReceive = parseBoolean(value, delegation.canReceive);
    } else if (key === "canDelegate") {
      delegation.canDelegate = parseBoolean(value, delegation.canDelegate);
    }

    index += 1;
  }

  return {
    delegation,
    nextIndex: index
  };
}

function resolveReportsTo(params: {
  agentId: string;
  reportsTo: string | null | undefined;
  type: AgentType;
}): string | null {
  if (params.type === "manager") {
    if (isDefaultAgentId(params.agentId)) {
      return null;
    }
    if (params.reportsTo && params.reportsTo !== params.agentId) {
      return params.reportsTo;
    }
    return DEFAULT_AGENT_ID;
  }

  if (params.reportsTo === null) {
    return DEFAULT_AGENT_ID;
  }
  if (params.reportsTo && params.reportsTo !== params.agentId) {
    return params.reportsTo;
  }
  return isDefaultAgentId(params.agentId) ? null : DEFAULT_AGENT_ID;
}

function parseBoolean(rawValue: string, fallback: boolean): boolean {
  const normalized = unquote(rawValue).toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "no" || normalized === "0") {
    return false;
  }
  return fallback;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function sanitizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
