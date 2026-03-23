import type { PlaybookManifest, PlaybookSource, PlaybookPhase } from "@opengoat/contracts";

export type { PlaybookManifest, PlaybookSource, PlaybookPhase };

export type GoalType =
  | "launch"
  | "conversion"
  | "outbound"
  | "seo"
  | "content"
  | "competitive"
  | "lead-gen"
  | "onboarding";
