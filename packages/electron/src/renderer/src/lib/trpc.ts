import { createTRPCUntypedClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import {
  DESKTOP_IPC_CONTRACT_VERSION,
  type DesktopContractInfo
} from "@shared/workbench-contract";
import type {
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

export function createWorkbenchApiClient(): WorkbenchApiClient {
  return {
    validateContract: async () => {
      const trpc = getTrpcClient();
      const contract = (await trpc.query("meta.contract")) as DesktopContractInfo;
      if (contract.version !== DESKTOP_IPC_CONTRACT_VERSION) {
        throw new Error(
          `Desktop IPC contract mismatch. Renderer expects v${DESKTOP_IPC_CONTRACT_VERSION}, main exposes v${contract.version}.`
        );
      }
      contractValidated = true;
      return contract;
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
    renameProject: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("projects.rename", input)) as WorkbenchProject;
    },
    removeProject: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      await trpc.mutation("projects.remove", input);
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
  if (contract.version !== DESKTOP_IPC_CONTRACT_VERSION) {
    throw new Error(
      `Desktop IPC contract mismatch. Renderer expects v${DESKTOP_IPC_CONTRACT_VERSION}, main exposes v${contract.version}.`
    );
  }
  contractValidated = true;
}
