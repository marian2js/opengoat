export interface Skill {
  id: string;
  name: string;
  description: string;
  source: "managed" | "extra" | string;
}

export interface SkillsResponse {
  scope: "agent" | "global";
  skills: Skill[];
  agentId?: string;
}

export interface SkillInstallRequest {
  scope: "agent" | "global";
  agentId?: string;
  skillName?: string;
  sourcePath?: string;
  sourceUrl?: string;
  sourceSkillName?: string;
  description?: string;
  assignToAllAgents?: boolean;
}

export interface SkillInstallResult {
  scope: "agent" | "global";
  agentId?: string;
  assignedAgentIds?: string[];
  skillId: string;
  skillName: string;
  source: "managed" | "source-path" | "source-url" | "generated";
  installedPath: string;
  workspaceInstallPaths?: string[];
  replaced: boolean;
}

export interface SkillRemoveRequest {
  scope: "agent" | "global";
  agentId?: string;
  skillId: string;
}

export interface SkillRemoveResult {
  scope: "agent" | "global";
  skillId: string;
  agentId?: string;
  removedFromGlobal: boolean;
  removedFromAgentIds: string[];
  removedWorkspacePaths: string[];
}
