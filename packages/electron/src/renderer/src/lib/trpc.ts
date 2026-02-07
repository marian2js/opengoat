import { createTRPCUntypedClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import {
  DESKTOP_IPC_CONTRACT_VERSION,
  type DesktopContractInfo
} from "@shared/workbench-contract";
import type {
  WorkbenchBootstrap,
  WorkbenchGuidedAuthResult,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject,
  WorkbenchSession
} from "@shared/workbench";
import superjson from "superjson";

export interface WorkbenchApiClient {
  validateContract: () => Promise<DesktopContractInfo>;
  bootstrap: () => Promise<WorkbenchBootstrap>;
  listProjects: () => Promise<WorkbenchProject[]>;
  pickProject: () => Promise<WorkbenchProject | null>;
  addProject: (input: { rootPath: string }) => Promise<WorkbenchProject>;
  createSession: (input: { projectId: string; title?: string }) => Promise<WorkbenchSession>;
  getSessionMessages: (input: { projectId: string; sessionId: string }) => Promise<WorkbenchMessage[]>;
  getOnboardingStatus: () => Promise<WorkbenchOnboarding>;
  runOnboardingGuidedAuth: (input: { providerId: string }) => Promise<WorkbenchGuidedAuthResult>;
  submitOnboarding: (input: { providerId: string; env: Record<string, string> }) => Promise<WorkbenchOnboarding>;
  sendChatMessage: (input: {
    projectId: string;
    sessionId: string;
    message: string;
  }) => Promise<{
    reply: WorkbenchMessage;
    tracePath?: string;
    providerId: string;
  }>;
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
    createSession: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("sessions.create", input)) as WorkbenchSession;
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
    sendChatMessage: async (input) => {
      const trpc = getTrpcClient();
      await ensureContract(trpc);
      return (await trpc.mutation("chat.send", input)) as {
        reply: WorkbenchMessage;
        tracePath?: string;
        providerId: string;
      };
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
