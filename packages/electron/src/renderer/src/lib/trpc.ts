import { createTRPCUntypedClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import {
  MIN_DESKTOP_IPC_CONTRACT_VERSION,
  DESKTOP_IPC_CONTRACT_VERSION,
  type DesktopContractInfo
} from "@shared/workbench-contract";
import type {
  WorkbenchAgent,
  WorkbenchAgentCreationResult,
  WorkbenchAgentDeletionResult,
  WorkbenchAgentProvider,
  WorkbenchBootstrap,
  WorkbenchGatewayStatus,
  WorkbenchGuidedAuthResult,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject,
  WorkbenchSendMessageResult,
  WorkbenchSession
} from "@shared/workbench";
import superjson from "superjson";

export interface WorkbenchApiClient {
  validateContract: () => Promise<DesktopContractInfo>;
  bootstrap: () => Promise<WorkbenchBootstrap>;
  listProjects: () => Promise<WorkbenchProject[]>;
  pickProject: () => Promise<WorkbenchProject | null>;
  addProject: (input: { rootPath: string }) => Promise<WorkbenchProject>;
  renameProject: (input: { projectId: string; name: string }) => Promise<WorkbenchProject>;
  removeProject: (input: { projectId: string }) => Promise<void>;
  listAgents: () => Promise<WorkbenchAgent[]>;
  listAgentProviders: () => Promise<WorkbenchAgentProvider[]>;
  saveAgentProviderConfig: (input: {
    providerId: string;
    env: Record<string, string>;
  }) => Promise<WorkbenchAgentProvider>;
  createAgent: (input: {
    name: string;
    providerId?: string;
    createExternalAgent?: boolean;
    env?: Record<string, string>;
  }) => Promise<WorkbenchAgentCreationResult>;
  deleteAgent: (input: {
    agentId: string;
    providerId?: string;
    deleteExternalAgent?: boolean;
  }) => Promise<WorkbenchAgentDeletionResult>;
  createSession: (input: { projectId: string; title?: string }) => Promise<WorkbenchSession>;
  renameSession: (input: { projectId: string; sessionId: string; title: string }) => Promise<WorkbenchSession>;
  removeSession: (input: { projectId: string; sessionId: string }) => Promise<void>;
  getSessionMessages: (input: { projectId: string; sessionId: string }) => Promise<WorkbenchMessage[]>;
  getOnboardingStatus: () => Promise<WorkbenchOnboarding>;
  runOnboardingGuidedAuth: (input: { providerId: string }) => Promise<WorkbenchGuidedAuthResult>;
  submitOnboarding: (input: { providerId: string; env: Record<string, string> }) => Promise<WorkbenchOnboarding>;
  completeOnboarding: () => Promise<void>;
  getGatewayStatus: () => Promise<WorkbenchGatewayStatus>;
  updateGatewaySettings: (input: {
    mode: "local" | "remote";
    remoteUrl?: string;
    remoteToken?: string;
    timeoutMs?: number;
  }) => Promise<WorkbenchGatewayStatus>;
  sendChatMessage: (input: {
    projectId: string;
    sessionId: string;
    message: string;
  }) => Promise<WorkbenchSendMessageResult>;
}

function createLinks() {
  const createIpcLink = ipcLink as unknown as () => (runtime: unknown) => unknown;
  const link = createIpcLink();
  return [
    ((runtime: unknown) =>
      link({
        ...(runtime as Record<string, unknown>),
        transformer: superjson
      })) as unknown
  ];
}

type TrpcClient = ReturnType<typeof createTRPCUntypedClient>;

let trpcClient: TrpcClient | null = null;

function getTrpcClient(): TrpcClient {
  if (!trpcClient) {
    trpcClient = createTRPCUntypedClient({
      links: createLinks() as never
    } as never) as TrpcClient;
  }
  return trpcClient;
}

let contractValidated = false;
function assertContractVersion(contract: DesktopContractInfo): void {
  if (contract.version > DESKTOP_IPC_CONTRACT_VERSION) {
    throw new Error(
      `Desktop IPC contract mismatch. Renderer expects v${DESKTOP_IPC_CONTRACT_VERSION}, main exposes v${contract.version}.`
    );
  }
  if (contract.version < MIN_DESKTOP_IPC_CONTRACT_VERSION) {
    throw new Error(
      `Desktop IPC contract mismatch. Renderer expects v${MIN_DESKTOP_IPC_CONTRACT_VERSION}+ but main exposes v${contract.version}.`
    );
  }
}

function recordContract(contract: DesktopContractInfo): DesktopContractInfo {
  assertContractVersion(contract);
  contractValidated = true;
  return contract;
}

export function createWorkbenchApiClient(): WorkbenchApiClient {
  return {
    validateContract: async () => {
      const trpc = getTrpcClient();
      const contract = (await trpc.query("meta.contract")) as DesktopContractInfo;
      return recordContract(contract);
    },
    bootstrap: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("bootstrap")) as WorkbenchBootstrap;
    },
    listProjects: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("projects.list")) as WorkbenchProject[];
    },
    pickProject: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("projects.pick")) as WorkbenchProject | null;
    },
    addProject: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("projects.add", input)) as WorkbenchProject;
    },
    listAgents: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("agents.list")) as WorkbenchAgent[];
    },
    listAgentProviders: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("agents.providers")) as WorkbenchAgentProvider[];
    },
    saveAgentProviderConfig: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("agents.saveProviderConfig", input)) as WorkbenchAgentProvider;
    },
    createAgent: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("agents.create", input)) as WorkbenchAgentCreationResult;
    },
    deleteAgent: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("agents.delete", input)) as WorkbenchAgentDeletionResult;
    },
    renameProject: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("projects.rename", input)) as WorkbenchProject;
    },
    removeProject: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      try {
        await trpc.mutation("projects.remove", input);
      } catch (error) {
        if (isMissingProcedureError(error, "projects.remove")) {
          throw new Error(
            "Desktop runtime is outdated for project removal. Restart OpenGoat and try again."
          );
        }
        throw error;
      }
    },
    createSession: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("sessions.create", input)) as WorkbenchSession;
    },
    renameSession: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("sessions.rename", input)) as WorkbenchSession;
    },
    removeSession: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      await trpc.mutation("sessions.remove", input);
    },
    getSessionMessages: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("sessions.messages", input)) as WorkbenchMessage[];
    },
    getOnboardingStatus: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("onboarding.status")) as WorkbenchOnboarding;
    },
    runOnboardingGuidedAuth: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("onboarding.guidedAuth", input)) as WorkbenchGuidedAuthResult;
    },
    submitOnboarding: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("onboarding.submit", input)) as WorkbenchOnboarding;
    },
    completeOnboarding: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      await trpc.mutation("onboarding.complete");
    },
    getGatewayStatus: async () => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.query("gateway.status")) as WorkbenchGatewayStatus;
    },
    updateGatewaySettings: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("gateway.update", input)) as WorkbenchGatewayStatus;
    },
    sendChatMessage: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("chat.send", input)) as WorkbenchSendMessageResult;
    }
  };
}

async function ensureContract(client: TrpcClient): Promise<void> {
  if (contractValidated) {
    return;
  }

  const contract = (await client.query("meta.contract")) as DesktopContractInfo;
  recordContract(contract);
}

function isMissingProcedureError(error: unknown, path: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes(`No "mutation"-procedure on path "${path}"`);
}
