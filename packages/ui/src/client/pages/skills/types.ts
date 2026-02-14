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
