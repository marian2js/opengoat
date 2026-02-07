export interface OpenGoatPaths {
  homeDir: string;
  workspacesDir: string;
  agentsDir: string;
  skillsDir: string;
  providersDir: string;
  runsDir: string;
  globalConfigJsonPath: string;
  globalConfigMarkdownPath: string;
  agentsIndexJsonPath: string;
}

export interface OpenGoatConfig {
  schemaVersion: number;
  defaultAgent: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentsIndex {
  schemaVersion: number;
  agents: string[];
  updatedAt: string;
}

export interface InitializationResult {
  paths: OpenGoatPaths;
  createdPaths: string[];
  skippedPaths: string[];
  defaultAgent: string;
}
