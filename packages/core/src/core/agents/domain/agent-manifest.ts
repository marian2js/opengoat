import { isDefaultAgentId, normalizeAgentId } from "../../domain/agent-id.js";
import { DEFAULT_PROVIDER_ID } from "../../providers/index.js";

export interface AgentDelegationMetadata {
  canReceive: boolean;
  canDelegate: boolean;
}

export interface AgentManifestMetadata {
  id: string;
  name: string;
  description: string;
  provider: string;
  discoverable: boolean;
  tags: string[];
  delegation: AgentDelegationMetadata;
  priority: number;
}

export interface AgentManifest {
  agentId: string;
  filePath: string;
  workspaceDir: string;
  metadata: AgentManifestMetadata;
  body: string;
  source: "frontmatter" | "derived";
}

export function isDiscoverableByOrchestrator(manifest: AgentManifest): boolean {
  return manifest.metadata.discoverable && manifest.metadata.delegation.canReceive;
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
      const parsedTags = parseTagsValue(rawValue, lines, index);
      data.tags = parsedTags.tags;
      index = parsedTags.nextIndex;
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

    if (key === "provider") {
      const provider = sanitizeId(unquote(rawValue));
      if (provider) {
        data.provider = provider;
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
  providerId: string;
  metadata?: Partial<AgentManifestMetadata>;
}): AgentManifestMetadata {
  const metadata = params.metadata ?? {};
  const agentId = normalizeAgentId(metadata.id ?? params.agentId) || normalizeAgentId(params.agentId) || "agent";
  const name = metadata.name?.trim() || params.displayName.trim() || agentId;
  const description =
    metadata.description?.trim() || (isDefaultAgentId(agentId) ? "Primary orchestration agent." : `Agent ${name}.`);
  const provider =
    sanitizeId(metadata.provider ?? params.providerId) || sanitizeId(params.providerId) || DEFAULT_PROVIDER_ID;
  const discoverable = metadata.discoverable ?? true;
  const tags = dedupeTags(metadata.tags ?? []);
  const delegation = {
    canReceive: metadata.delegation?.canReceive ?? true,
    canDelegate: metadata.delegation?.canDelegate ?? isDefaultAgentId(agentId)
  };
  const priority =
    typeof metadata.priority === "number" && Number.isFinite(metadata.priority) ? metadata.priority : DEFAULT_PRIORITY;

  return {
    id: agentId,
    name,
    description,
    provider,
    discoverable,
    tags,
    delegation,
    priority
  };
}

export function formatAgentManifestMarkdown(metadata: AgentManifestMetadata, body: string): string {
  const safeBody = body.startsWith("\n") ? body.slice(1) : body;
  const tagsValue = metadata.tags.join(", ");

  return [
    "---",
    `id: ${metadata.id}`,
    `name: ${metadata.name}`,
    `description: ${metadata.description}`,
    `provider: ${metadata.provider}`,
    `discoverable: ${metadata.discoverable}`,
    `tags: [${tagsValue}]`,
    "delegation:",
    `  canReceive: ${metadata.delegation.canReceive}`,
    `  canDelegate: ${metadata.delegation.canDelegate}`,
    `priority: ${metadata.priority}`,
    "---",
    "",
    safeBody.endsWith("\n") ? safeBody.slice(0, -1) : safeBody
  ].join("\n") + "\n";
}

function parseTagsValue(
  rawValue: string,
  lines: string[],
  startIndex: number
): { tags: string[]; nextIndex: number } {
  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    const tags = rawValue
      .slice(1, -1)
      .split(",")
      .map((value) => sanitizeTag(unquote(value.trim())))
      .filter(Boolean);
    return { tags: dedupeTags(tags), nextIndex: startIndex };
  }

  const tags: string[] = [];
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

    const tag = sanitizeTag(unquote(trimmed.slice(2).trim()));
    if (tag) {
      tags.push(tag);
    }
    index += 1;
  }

  return {
    tags: dedupeTags(tags),
    nextIndex: index
  };
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

function dedupeTags(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
