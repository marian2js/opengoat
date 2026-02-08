import { z } from "zod";

export const DESKTOP_IPC_CONTRACT_VERSION = 5 as const;

export const desktopContractSchema = z.object({
  version: z.literal(DESKTOP_IPC_CONTRACT_VERSION)
});

export type DesktopContractInfo = z.infer<typeof desktopContractSchema>;
