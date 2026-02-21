import { DEFAULT_AGENT_ID } from "../../domain/agent-id.js";

export type SkillSource = "managed" | "extra";
export type SkillScope = "agent" | "global";

export interface AgentSkillsLoadConfig {
  extraDirs?: string[];
}

export interface AgentSkillsPromptConfig {
  maxSkills?: number;
  maxCharsPerSkill?: number;
  maxTotalChars?: number;
  includeContent?: boolean;
}

export interface AgentSkillsConfig {
  enabled?: boolean;
  includeManaged?: boolean;
  assigned?: string[];
  load?: AgentSkillsLoadConfig;
  prompt?: AgentSkillsPromptConfig;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  enabled?: boolean;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
}

export interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source: SkillSource;
  skillDir: string;
  skillFilePath: string;
  content: string;
  frontmatter: SkillFrontmatter;
}

export interface SkillsPromptResult {
  prompt: string;
  skills: ResolvedSkill[];
}

export interface InstallSkillRequest {
  agentId?: string;
  skillName: string;
  sourcePath?: string;
  sourceUrl?: string;
  sourceSkillName?: string;
  description?: string;
  content?: string;
  scope?: SkillScope;
  assignToAllAgents?: boolean;
}

export interface InstallSkillResult {
  scope: SkillScope;
  agentId?: string;
  assignedAgentIds?: string[];
  skillId: string;
  skillName: string;
  source: "managed" | "source-path" | "source-url" | "generated";
  installedPath: string;
  workspaceInstallPaths?: string[];
  replaced: boolean;
}

export interface RemoveSkillRequest {
  scope?: SkillScope;
  agentId?: string;
  skillId: string;
}

export interface RemoveSkillResult {
  scope: SkillScope;
  skillId: string;
  agentId?: string;
  removedFromGlobal: boolean;
  removedFromAgentIds: string[];
  removedWorkspacePaths: string[];
}

export const DEFAULT_SKILLS_CONFIG: Required<Omit<AgentSkillsConfig, "load" | "prompt">> & {
  load: Required<AgentSkillsLoadConfig>;
  prompt: Required<AgentSkillsPromptConfig>;
} = {
  enabled: true,
  includeManaged: true,
  assigned: [],
  load: {
    extraDirs: []
  },
  prompt: {
    maxSkills: 12,
    maxCharsPerSkill: 6_000,
    maxTotalChars: 36_000,
    includeContent: true
  }
};

export function resolveSkillsConfig(input: AgentSkillsConfig | undefined): typeof DEFAULT_SKILLS_CONFIG {
  const prompt = input?.prompt;
  const load = input?.load;
  return {
    enabled: input?.enabled ?? DEFAULT_SKILLS_CONFIG.enabled,
    includeManaged: input?.includeManaged ?? DEFAULT_SKILLS_CONFIG.includeManaged,
    assigned: Array.isArray(input?.assigned)
      ? [...new Set(input.assigned.map((value) => value.trim().toLowerCase()).filter(Boolean))]
      : DEFAULT_SKILLS_CONFIG.assigned,
    load: {
      extraDirs: Array.isArray(load?.extraDirs)
        ? load.extraDirs.map((value) => value.trim()).filter(Boolean)
        : DEFAULT_SKILLS_CONFIG.load.extraDirs
    },
    prompt: {
      maxSkills: asPositiveInt(prompt?.maxSkills, DEFAULT_SKILLS_CONFIG.prompt.maxSkills),
      maxCharsPerSkill: asPositiveInt(prompt?.maxCharsPerSkill, DEFAULT_SKILLS_CONFIG.prompt.maxCharsPerSkill),
      maxTotalChars: asPositiveInt(prompt?.maxTotalChars, DEFAULT_SKILLS_CONFIG.prompt.maxTotalChars),
      includeContent: prompt?.includeContent ?? DEFAULT_SKILLS_CONFIG.prompt.includeContent
    }
  };
}

export function resolveSkillAgentId(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized || DEFAULT_AGENT_ID;
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}
