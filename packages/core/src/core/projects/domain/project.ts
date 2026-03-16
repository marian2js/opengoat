import type { AgentDescriptor } from "../../domain/agent.js";

export interface ProjectAgentDescriptor extends AgentDescriptor {
  roleId: "cmo";
  providerId: "openclaw";
}

export interface ProjectDescriptor {
  id: string;
  displayName: string;
  sourceUrl: string;
  sourceHost: string;
  rootDir: string;
  configPath: string;
  cmoAgent: ProjectAgentDescriptor;
}

export interface ProjectCreationResult {
  project: ProjectDescriptor;
  alreadyExisted: boolean;
  createdPaths: string[];
  skippedPaths: string[];
  runtimeSync?: {
    runtimeId: string;
    code: number;
    stdout: string;
    stderr: string;
  };
}
