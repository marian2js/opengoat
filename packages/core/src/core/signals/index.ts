export { SignalService } from "./application/signal.service.js";
export { WorkspaceSignalDetector } from "./application/workspace-signal-detector.js";
export type {
  CreateSignalOptions,
  ListSignalsOptions,
  SignalRecord,
} from "./domain/signal.js";
export { SIGNAL_TYPES, VALID_STATUS_TRANSITIONS } from "./domain/signal.js";
