export interface ScenarioAgentSpec {
  id: string;
  name: string;
  description: string;
}

export interface ScenarioScriptedSpec {
  agentReplies: Record<string, string>;
}

export interface ScenarioAssertions {
  mustSucceed?: boolean;
  stdoutIncludes?: string[];
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
}
