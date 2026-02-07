export interface ScenarioAgentSpec {
  id: string;
  name: string;
  description: string;
}

export interface ScenarioScriptedSpec {
  orchestratorActions: Array<{
    rationale: string;
    action: {
      type: "delegate_to_agent" | "respond_user" | "finish";
      mode?: "direct" | "artifacts" | "hybrid";
      targetAgentId?: string;
      message: string;
      expectedOutput?: string;
    };
  }>;
  agentReplies: Record<string, string>;
}

export interface ScenarioAssertions {
  mustSucceed?: boolean;
  stdoutIncludes?: string[];
  delegatedAgents?: string[];
  minSteps?: number;
  maxSteps?: number;
}

export interface ScenarioSpec {
  name: string;
  message: string;
  entryAgentId?: string;
  agents?: ScenarioAgentSpec[];
  scripted?: ScenarioScriptedSpec;
  assertions?: ScenarioAssertions;
}

export interface ScenarioRunResult {
  scenarioName: string;
  mode: "live" | "scripted";
  success: boolean;
  failures: string[];
  tracePath: string;
  output: string;
  delegatedAgents: string[];
  steps: number;
}
