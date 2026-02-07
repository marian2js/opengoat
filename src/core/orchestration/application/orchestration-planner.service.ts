import type { AgentManifest } from "../../agents/index.js";
import { DEFAULT_AGENT_ID } from "../../domain/agent-id.js";
import type {
  OrchestrationAction,
  OrchestrationAgentDescriptor,
  OrchestrationPlannerDecision,
  OrchestrationTaskSessionPolicy
} from "../domain/loop.js";

export interface OrchestrationPlannerInput {
  userMessage: string;
  step: number;
  maxSteps: number;
  sharedNotes: string;
  recentEvents: string[];
  agents: AgentManifest[];
  taskThreads?: Array<{
    taskKey: string;
    agentId: string;
    providerId?: string;
    providerSessionId?: string;
    updatedStep: number;
    lastResponse?: string;
  }>;
}

export class OrchestrationPlannerService {
  public buildPlannerPrompt(input: OrchestrationPlannerInput): string {
    const agentDescriptors = input.agents
      .map(toAgentDescriptor)
      .filter((agent) => agent.agentId !== DEFAULT_AGENT_ID && agent.canReceive);

    const lines: string[] = [
      "You are the OpenGoat orchestrator decision engine.",
      "Decide the next best action to solve the user request.",
      "Use only the JSON format requested below; do not add extra text.",
      "",
      "Action policy:",
      "- Use delegate_to_agent when a specialized agent should execute the next step.",
      "- Use install_skill when a skill should be installed for an agent before continuing.",
      "- Use read_workspace_file / write_workspace_file when coordination artifacts are needed.",
      "- Use respond_user when you can directly answer with high confidence.",
      "- Use finish when the task is complete.",
      "- Prefer hybrid mode for important handoffs (direct + markdown artifact).",
      "- For delegate_to_agent, use taskKey to keep related work on the same task thread.",
      '- sessionPolicy controls thread behavior: "new" creates a new thread, "reuse" requires an existing thread, "auto" reuses when available or creates otherwise.',
      "",
      "Allowed agents:",
      ...agentDescriptors.map(
        (agent) =>
          `- ${agent.agentId}: name=${agent.name}; description=${agent.description}; provider=${agent.provider}; canDelegate=${agent.canDelegate}`
      ),
      "",
      `Step ${input.step}/${input.maxSteps}`,
      "",
      "User request:",
      input.userMessage,
      "",
      "Shared notes:",
      input.sharedNotes || "(none)",
      "",
      "Recent events:",
      ...(input.recentEvents.length > 0 ? input.recentEvents.map((entry) => `- ${entry}`) : ["- (none)"]),
      "",
      "Known task threads:",
      ...(input.taskThreads && input.taskThreads.length > 0
        ? input.taskThreads.map((thread) =>
            `- ${thread.taskKey}: agent=${thread.agentId}; provider=${thread.providerId ?? "unknown"}; providerSessionId=${thread.providerSessionId ?? "(none)"}; updatedStep=${thread.updatedStep}; lastResponse=${thread.lastResponse?.trim() || "(none)"}`
          )
        : ["- (none)"]),
      "",
      "Return JSON with shape:",
      "{",
      '  "rationale": "short reason",',
      '  "action": {',
      '    "type": "delegate_to_agent|read_workspace_file|write_workspace_file|install_skill|respond_user|finish",',
      '    "mode": "direct|artifacts|hybrid",',
      '    "reason": "optional short reason",',
      '    "targetAgentId": "required for delegate_to_agent",',
      '    "message": "required for delegate_to_agent/respond_user/finish",',
      '    "expectedOutput": "optional for delegate_to_agent",',
      '    "taskKey": "optional for delegate_to_agent (stable id like task-auth-fix)",',
      '    "sessionPolicy": "optional for delegate_to_agent: auto|new|reuse",',
      '    "path": "required for read_workspace_file/write_workspace_file",',
      '    "content": "required for write_workspace_file; optional for install_skill to create inline skill content",',
      '    "skillName": "required for install_skill",',
      '    "description": "optional for install_skill",',
      '    "sourcePath": "optional for install_skill"',
      "  }",
      "}"
    ];

    return lines.join("\n");
  }

  public parseDecision(raw: string, fallbackMessage: string): OrchestrationPlannerDecision {
    const parsed = tryParseJson(raw);
    if (parsed && isPlannerDecision(parsed)) {
      return sanitizeDecision(parsed);
    }

    return {
      rationale: "Planner output was not valid JSON. Falling back to direct user response.",
      action: {
        type: "respond_user",
        message: fallbackMessage,
        mode: "direct",
        reason: "planner_parse_failure"
      }
    };
  }
}

function toAgentDescriptor(manifest: AgentManifest): OrchestrationAgentDescriptor {
  return {
    agentId: manifest.agentId,
    name: manifest.metadata.name,
    description: manifest.metadata.description,
    provider: manifest.metadata.provider,
    canReceive: manifest.metadata.delegation.canReceive,
    canDelegate: manifest.metadata.delegation.canDelegate
  };
}

function tryParseJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fenced = extractFencedJson(trimmed);
  const candidates = [fenced, trimmed].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // continue
    }
  }

  const object = extractJsonObject(trimmed);
  if (!object) {
    return null;
  }
  try {
    return JSON.parse(object) as unknown;
  } catch {
    return null;
  }
}

function extractFencedJson(value: string): string | null {
  const match = value.match(/```json\s*([\s\S]*?)```/i);
  if (!match) {
    return null;
  }
  return match[1]?.trim() ?? null;
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return value.slice(start, end + 1);
}

function isPlannerDecision(value: unknown): value is OrchestrationPlannerDecision {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as { rationale?: unknown; action?: unknown };
  if (typeof record.rationale !== "string") {
    return false;
  }

  return isAction(record.action);
}

function isAction(value: unknown): value is OrchestrationAction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as {
    type?: unknown;
    mode?: unknown;
    targetAgentId?: unknown;
    message?: unknown;
    taskKey?: unknown;
    sessionPolicy?: unknown;
    path?: unknown;
    content?: unknown;
    skillName?: unknown;
    description?: unknown;
    sourcePath?: unknown;
  };
  if (
    record.mode !== undefined &&
    record.mode !== "direct" &&
    record.mode !== "artifacts" &&
    record.mode !== "hybrid"
  ) {
    return false;
  }
  if (
    record.sessionPolicy !== undefined &&
    record.sessionPolicy !== "auto" &&
    record.sessionPolicy !== "new" &&
    record.sessionPolicy !== "reuse"
  ) {
    return false;
  }

  if (record.type === "delegate_to_agent") {
    if (typeof record.targetAgentId !== "string" || typeof record.message !== "string") {
      return false;
    }
    if (record.taskKey !== undefined && typeof record.taskKey !== "string") {
      return false;
    }
    return true;
  }
  if (record.type === "read_workspace_file") {
    return typeof record.path === "string";
  }
  if (record.type === "write_workspace_file") {
    return typeof record.path === "string" && typeof record.content === "string";
  }
  if (record.type === "install_skill") {
    if (typeof record.skillName !== "string") {
      return false;
    }
    if (record.targetAgentId !== undefined && typeof record.targetAgentId !== "string") {
      return false;
    }
    if (record.sourcePath !== undefined && typeof record.sourcePath !== "string") {
      return false;
    }
    if (record.description !== undefined && typeof record.description !== "string") {
      return false;
    }
    if (record.content !== undefined && typeof record.content !== "string") {
      return false;
    }
    return true;
  }
  if (record.type === "respond_user" || record.type === "finish") {
    return typeof record.message === "string";
  }

  return false;
}

function sanitizeDecision(decision: OrchestrationPlannerDecision): OrchestrationPlannerDecision {
  const action = decision.action;
  if (action.type === "delegate_to_agent") {
    return {
      rationale: decision.rationale.trim() || "Delegating to specialized agent.",
      action: {
        ...action,
        targetAgentId: action.targetAgentId.trim().toLowerCase(),
        message: action.message.trim(),
        mode: action.mode ?? "hybrid",
        taskKey: normalizeTaskKey(action.taskKey),
        sessionPolicy: normalizeSessionPolicy(action.sessionPolicy)
      }
    };
  }

  if (action.type === "respond_user" || action.type === "finish") {
    return {
      rationale: decision.rationale.trim() || "Responding directly to user.",
      action: {
        ...action,
        message: action.message.trim(),
        mode: action.mode ?? "direct"
      }
    };
  }

  if (action.type === "read_workspace_file") {
    return {
      rationale: decision.rationale.trim() || "Reading workspace file.",
      action: {
        ...action,
        path: action.path.trim(),
        mode: action.mode ?? "artifacts"
      }
    };
  }

  if (action.type === "install_skill") {
    return {
      rationale: decision.rationale.trim() || "Installing skill.",
      action: {
        ...action,
        skillName: action.skillName.trim(),
        targetAgentId: action.targetAgentId?.trim().toLowerCase(),
        sourcePath: action.sourcePath?.trim(),
        description: action.description?.trim(),
        content: action.content,
        mode: action.mode ?? "artifacts"
      }
    };
  }

  return {
    rationale: decision.rationale.trim() || "Writing workspace file.",
    action: {
      ...action,
      path: action.path.trim(),
      content: action.content,
      mode: action.mode ?? "artifacts"
    }
  };
}

function normalizeTaskKey(raw: string | undefined): string | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  const normalized = value
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || undefined;
}

function normalizeSessionPolicy(raw: OrchestrationTaskSessionPolicy | undefined): OrchestrationTaskSessionPolicy {
  if (raw === "new" || raw === "reuse" || raw === "auto") {
    return raw;
  }
  return "auto";
}
