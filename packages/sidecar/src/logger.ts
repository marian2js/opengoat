const LOG_PREFIX = "[sidecar]";

export interface SidecarLogger {
  error(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  child(prefix: string): SidecarLogger;
}

function formatArgs(prefix: string, message: string, detail?: unknown): unknown[] {
  return detail !== undefined ? [prefix, message, detail] : [prefix, message];
}

function createSidecarLogger(prefix: string): SidecarLogger {
  return {
    error(message, detail) {
      console.error(...formatArgs(prefix, message, detail));
    },
    info(message, detail) {
      console.error(...formatArgs(prefix, message, detail));
    },
    warn(message, detail) {
      console.error(...formatArgs(prefix, message, detail));
    },
    child(childPrefix) {
      return createSidecarLogger(`${prefix}:${childPrefix}`);
    },
  };
}

export const sidecarLogger: SidecarLogger = createSidecarLogger(LOG_PREFIX);
