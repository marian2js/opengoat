import { z } from "zod";

export const MIN_DESKTOP_IPC_CONTRACT_VERSION = 6 as const;
export const DESKTOP_IPC_CONTRACT_VERSION = 8 as const;
export const DESKTOP_IPC_CONTRACT_FEATURES = {
  agents: 7,
  agentProviderConfig: 8
} as const;

export const desktopContractSchema = z.object({
  version: z.number().int().positive()
});

export type DesktopContractInfo = z.infer<typeof desktopContractSchema>;
