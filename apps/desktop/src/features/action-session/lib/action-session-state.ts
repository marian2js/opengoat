import type { ActionSessionState, ActionSessionMeta, OutputBlock } from "../types";

/**
 * Derive the action session state from chat status and messages.
 * Pure function — no side effects.
 */
export function deriveActionSessionState(
  chatStatus: string,
  messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>,
  savedToBoard: boolean,
): ActionSessionState {
  if (savedToBoard) {
    return "saved-to-board";
  }

  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const hasAssistantText = assistantMessages.some((m) =>
    m.parts.some((p) => p.type === "text" && p.text && p.text.trim().length > 0),
  );

  // Starting: no assistant text outputs yet
  if (!hasAssistantText) {
    return "starting";
  }

  // Working: actively streaming
  if (chatStatus === "streaming" || chatStatus === "submitted") {
    return "working";
  }

  // Needs input: chat is ready and last assistant message ends with a question
  if (chatStatus === "ready" && assistantMessages.length > 0) {
    const lastAssistant = assistantMessages[assistantMessages.length - 1]!;
    const textParts = lastAssistant.parts.filter(
      (p) => p.type === "text" && p.text && p.text.trim().length > 0,
    );
    if (textParts.length > 0) {
      const lastText = textParts[textParts.length - 1]!.text!.trim();
      if (lastText.endsWith("?")) {
        return "needs-input";
      }
    }
  }

  // Ready to review: chat is done, outputs exist, not yet saved
  if (chatStatus === "ready" && hasAssistantText) {
    return "ready-to-review";
  }

  return "working";
}

/**
 * Extract output blocks from assistant messages.
 * Groups text content into discrete output cards.
 */
export function extractOutputs(
  messages: Array<{ id: string; role: string; parts: Array<{ type: string; text?: string }> }>,
): OutputBlock[] {
  const outputs: OutputBlock[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    const textParts = message.parts.filter(
      (p) => p.type === "text" && p.text && p.text.trim().length > 0,
    );

    for (let i = 0; i < textParts.length; i++) {
      const text = textParts[i]!.text!.trim();
      const title = deriveOutputTitle(text);
      outputs.push({
        id: `${message.id}-${String(i)}`,
        title,
        content: text,
        messageId: message.id,
      });
    }
  }

  return outputs;
}

/**
 * Derive a title from the first line or heading of text content.
 */
function deriveOutputTitle(text: string): string {
  const firstLine = text.split("\n")[0]!.trim();

  // Check for markdown heading
  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)/);
  if (headingMatch) {
    return headingMatch[1]!.slice(0, 60);
  }

  // Use first line, truncated
  const clean = firstLine.replace(/^\*\*(.+?)\*\*.*$/, "$1");
  if (clean.length <= 60) return clean;
  return `${clean.slice(0, 57)}...`;
}

// ── localStorage persistence for action session metadata ──

const META_KEY = "opengoat:actionSessionMeta";

type MetaStore = Record<string, ActionSessionMeta>;

function loadMetaStore(): MetaStore {
  try {
    const stored = localStorage.getItem(META_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as MetaStore;
      }
    }
  } catch {
    // Ignore
  }
  return {};
}

function persistMetaStore(store: MetaStore): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(store));
  } catch {
    // Ignore
  }
}

export function getActionSessionMeta(sessionId: string): ActionSessionMeta | null {
  const store = loadMetaStore();
  return store[sessionId] ?? null;
}

export function setActionSessionMeta(sessionId: string, meta: ActionSessionMeta): void {
  const store = loadMetaStore();
  store[sessionId] = meta;
  persistMetaStore(store);
}

export function updateActionSessionState(sessionId: string, state: ActionSessionState): void {
  const store = loadMetaStore();
  const existing = store[sessionId];
  if (existing) {
    store[sessionId] = { ...existing, state };
    persistMetaStore(store);
  }
}

export function getAllActionSessionMetas(): MetaStore {
  return loadMetaStore();
}

export function markSessionSavedToBoard(sessionId: string): void {
  const store = loadMetaStore();
  const existing = store[sessionId];
  if (existing) {
    store[sessionId] = { ...existing, savedToBoard: true, state: "saved-to-board" };
    persistMetaStore(store);
  }
}
