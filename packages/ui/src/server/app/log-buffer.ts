import {
  DEFAULT_LOG_STREAM_LIMIT,
  MAX_LOG_STREAM_LIMIT,
  MAX_UI_LOG_ENTRIES,
  OPENCLAW_LOG_POLL_INTERVAL_MS,
} from "./constants.js";
import {
  fetchOpenClawGatewayLogTail,
  parseCommandJson,
  resolveUiLogLevel,
  resolveUiLogMessageFromGatewayLine,
  resolveUiLogTimestamp,
} from "./runtime-logs.js";
import type { OpenClawUiService, UiLogBuffer, UiLogEntry } from "./types.js";

export function createUiLogBuffer(service: OpenClawUiService): UiLogBuffer {
  const entries: UiLogEntry[] = [];
  const listeners = new Set<(entry: UiLogEntry) => void>();
  let nextId = 1;
  let poller: NodeJS.Timeout | undefined;
  let pollInFlight = false;
  let cursor: number | undefined;
  let reportedPollFailure = false;

  const append = (entry: Omit<UiLogEntry, "id">): UiLogEntry => {
    const next: UiLogEntry = {
      ...entry,
      id: nextId,
    };
    nextId += 1;
    entries.push(next);
    if (entries.length > MAX_UI_LOG_ENTRIES) {
      entries.splice(0, entries.length - MAX_UI_LOG_ENTRIES);
    }
    for (const listener of listeners) {
      listener(next);
    }
    return next;
  };

  const pollOpenClawLogs = async (): Promise<void> => {
    if (pollInFlight || typeof service.getOpenClawGatewayConfig !== "function") {
      return;
    }

    pollInFlight = true;
    try {
      const tailed = await fetchOpenClawGatewayLogTail(service, {
        cursor,
        limit: 200,
        maxBytes: 250000,
      });
      cursor = tailed.cursor;
      for (const line of tailed.lines) {
        const parsed = parseCommandJson(line);
        const message = resolveUiLogMessageFromGatewayLine(parsed, line);
        if (!message) {
          continue;
        }
        append({
          timestamp: resolveUiLogTimestamp(parsed),
          level: resolveUiLogLevel(parsed),
          source: "openclaw",
          message,
        });
      }
      reportedPollFailure = false;
    } catch (error) {
      if (!reportedPollFailure) {
        append({
          timestamp: new Date().toISOString(),
          level: "warn",
          source: "opengoat",
          message:
            error instanceof Error
              ? `OpenClaw log stream unavailable: ${error.message}`
              : "OpenClaw log stream unavailable.",
        });
        reportedPollFailure = true;
      }
    } finally {
      pollInFlight = false;
    }
  };

  const ensurePolling = (): void => {
    if (
      poller ||
      listeners.size === 0 ||
      typeof service.getOpenClawGatewayConfig !== "function"
    ) {
      return;
    }
    void pollOpenClawLogs();
    poller = setInterval(() => {
      void pollOpenClawLogs();
    }, OPENCLAW_LOG_POLL_INTERVAL_MS);
    poller.unref?.();
  };

  const stopPollingIfIdle = (): void => {
    if (listeners.size > 0 || !poller) {
      return;
    }
    clearInterval(poller);
    poller = undefined;
  };

  return {
    append,
    listRecent: (limit: number): UiLogEntry[] => {
      if (entries.length === 0) {
        return [];
      }
      const safeLimit = Math.min(
        Math.max(1, Math.floor(limit || DEFAULT_LOG_STREAM_LIMIT)),
        MAX_LOG_STREAM_LIMIT,
      );
      return entries.slice(-safeLimit);
    },
    subscribe: (listener: (entry: UiLogEntry) => void): (() => void) => {
      listeners.add(listener);
      ensurePolling();
      return () => {
        listeners.delete(listener);
        stopPollingIfIdle();
      };
    },
    start: () => {
      ensurePolling();
    },
    stop: () => {
      if (poller) {
        clearInterval(poller);
        poller = undefined;
      }
    },
  };
}
