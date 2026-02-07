export { SkillService } from "./application/skill.service.js";
export type {
  AgentSkillsConfig,
  AgentSkillsLoadConfig,
  AgentSkillsPromptConfig,
  InstallSkillRequest,
  InstallSkillResult,
  ResolvedSkill,
  SkillFrontmatter,
  SkillScope,
  SkillSource,
  SkillsPromptResult
} from "./domain/skill.js";
export { DEFAULT_SKILLS_CONFIG, resolveSkillsConfig } from "./domain/skill.js";
