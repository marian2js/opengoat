export { AgentService } from "./application/agent.service.js";
export { AgentManifestService } from "./application/agent-manifest.service.js";
export type { AgentManifest, AgentManifestMetadata } from "./domain/agent-manifest.js";
export {
  BOARD_MANAGER_SKILL_ID,
  hasManagerSkill,
  isManagerAgent,
  isDiscoverableByManager,
  isDirectReport,
  parseAgentManifestMarkdown,
  normalizeAgentManifestMetadata,
  formatAgentManifestMarkdown
} from "./domain/agent-manifest.js";
