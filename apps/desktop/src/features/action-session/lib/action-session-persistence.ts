/**
 * sessionStorage persistence for action session context.
 *
 * Stores the pending action prompt, session ID, and title so that
 * the action session survives HMR / page reloads without losing
 * the in-flight prompt that triggers the AI call.
 *
 * Separated into its own module so that ActionSessionView.tsx only
 * exports React components — this keeps Vite Fast Refresh working.
 */

const SS_PENDING_PROMPT = "opengoat:pendingActionPrompt";
const SS_ACTION_SESSION_ID = "opengoat:actionSessionId";
const SS_ACTION_TITLE = "opengoat:actionTitle";
const SS_ACTION_PROMISE = "opengoat:actionPromise";
const SS_ACTION_OUTPUT_TYPE = "opengoat:actionOutputType";

/** Persist action context so it survives HMR / page reloads. */
export function persistActionContext(
  prompt: string,
  sessionId: string,
  title: string,
): void {
  try {
    sessionStorage.setItem(SS_PENDING_PROMPT, prompt);
    sessionStorage.setItem(SS_ACTION_SESSION_ID, sessionId);
    sessionStorage.setItem(SS_ACTION_TITLE, title);
  } catch {
    // sessionStorage not available — best-effort
  }
}

/** Clear persisted action context after it's been consumed. */
export function clearPersistedActionContext(): void {
  try {
    sessionStorage.removeItem(SS_PENDING_PROMPT);
    sessionStorage.removeItem(SS_ACTION_SESSION_ID);
    sessionStorage.removeItem(SS_ACTION_TITLE);
    sessionStorage.removeItem(SS_ACTION_PROMISE);
    sessionStorage.removeItem(SS_ACTION_OUTPUT_TYPE);
  } catch {
    // best-effort
  }
}

/** Read persisted action context (returns null if nothing stored). */
export function readPersistedActionContext(): {
  prompt: string;
  sessionId: string;
  title: string;
} | null {
  try {
    const prompt = sessionStorage.getItem(SS_PENDING_PROMPT);
    const sessionId = sessionStorage.getItem(SS_ACTION_SESSION_ID);
    const title = sessionStorage.getItem(SS_ACTION_TITLE);
    if (prompt && sessionId) {
      return { prompt, sessionId, title: title ?? "Action" };
    }
  } catch {
    // best-effort
  }
  return null;
}

/** Persist the output promise from the action card so the loading state can echo it. */
export function persistActionOutputPromise(
  promise: string,
  outputType: string,
): void {
  try {
    sessionStorage.setItem(SS_ACTION_PROMISE, promise);
    sessionStorage.setItem(SS_ACTION_OUTPUT_TYPE, outputType);
  } catch {
    // best-effort
  }
}

/** Read persisted output promise (returns null if nothing stored). */
export function readActionOutputPromise(): {
  promise: string;
  outputType: string;
} | null {
  try {
    const promise = sessionStorage.getItem(SS_ACTION_PROMISE);
    const outputType = sessionStorage.getItem(SS_ACTION_OUTPUT_TYPE);
    if (promise && outputType) {
      return { promise, outputType };
    }
  } catch {
    // best-effort
  }
  return null;
}
