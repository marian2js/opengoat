import { useEffect, useRef } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";

// ── Types ──

interface AutoArtifactMessage {
  id: string;
  role: string;
  parts: Array<{ type: string; text?: string }>;
}

interface UseAutoArtifactsOptions {
  messages: AutoArtifactMessage[];
  status: string;
  client: SidecarClient | null;
  agentId: string | undefined;
  specialistId: string | undefined;
  sessionId: string;
  /** Minimum content length to qualify as an artifact. Default: 200. */
  minContentLength?: number;
}

// ── Constants ──

const PERSISTED_KEY = "opengoat:persistedArtifactMessages";
const MAX_PERSISTED_IDS = 500;
const DEFAULT_MIN_CONTENT_LENGTH = 200;

// ── Pure utility functions (exported for testing) ──

/**
 * Infer the artifact type from content keywords.
 */
export function inferArtifactType(content: string): string {
  const lower = content.toLowerCase();

  if (/launch\s*(pack|plan|checklist|sequenc)/.test(lower) || /product\s*hunt/.test(lower)) {
    return "launch_pack";
  }
  if (/email\s*(sequence|draft|outreach)/.test(lower) || /cold\s*(email|outreach)/.test(lower) || /subject\s*line/.test(lower)) {
    return "email_sequence";
  }
  if (/\[[ x]\]/.test(content) || /checklist/i.test(lower)) {
    return "checklist";
  }
  if (/competitor|matrix|comparison\s*table/.test(lower)) {
    return "matrix";
  }
  if (/research\s*brief|market\s*research|community\s*analysis|customer\s*language/.test(lower)) {
    return "research_brief";
  }
  if (/hero\s*rewrite|homepage|landing\s*page|page\s*outline|cta\s*option/.test(lower)) {
    return "page_outline";
  }
  if (/seo|content\s*brief|keyword|search\s*visibility|answer.engine/.test(lower)) {
    return "copy_draft";
  }
  if (/content\s*ideas?|editorial|repurpos/.test(lower)) {
    return "copy_draft";
  }

  return "strategy_note";
}

/**
 * Check if content is structured enough to warrant an artifact.
 * Looks for markdown formatting indicators or sufficient length.
 */
export function isStructuredContent(text: string): boolean {
  // Long content is always considered structured
  if (text.length >= 400) return true;

  // Markdown headings
  if (/^#{1,3}\s+.+/m.test(text)) return true;

  // Bullet lists (3+ items)
  const bulletMatches = text.match(/^[\s]*[-*]\s+.+/gm);
  if (bulletMatches && bulletMatches.length >= 3) return true;

  // Numbered lists (3+ items)
  const numberedMatches = text.match(/^[\s]*\d+[.)]\s+.+/gm);
  if (numberedMatches && numberedMatches.length >= 3) return true;

  // Bold text
  if (/\*\*.+?\*\*/.test(text)) return true;

  // Tables
  if (/\|.+\|/.test(text) && /\|[\s-]+\|/.test(text)) return true;

  return false;
}

/**
 * Derive a human-readable title from content.
 */
export function deriveArtifactTitle(text: string): string {
  const firstLine = text.split("\n")[0]!.trim();

  // Check for markdown heading
  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)/);
  if (headingMatch) {
    return headingMatch[1]!.slice(0, 60);
  }

  // Check for bold first line
  const boldMatch = firstLine.match(/^\*\*(.+?)\*\*/);
  if (boldMatch) {
    return boldMatch[1]!.slice(0, 60);
  }

  // Use first line, truncated
  if (firstLine.length <= 60) return firstLine;
  return `${firstLine.slice(0, 57)}...`;
}

// ── Dedup persistence ──

export function getPersistedMessageIds(): Set<string> {
  try {
    const stored = localStorage.getItem(PERSISTED_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((v): v is string => typeof v === "string"));
      }
    }
  } catch {
    // Ignore
  }
  return new Set();
}

export function markMessagesPersisted(messageIds: string[]): void {
  const existing = getPersistedMessageIds();
  for (const id of messageIds) {
    existing.add(id);
  }
  // Keep bounded
  const arr = [...existing].slice(-MAX_PERSISTED_IDS);
  try {
    localStorage.setItem(PERSISTED_KEY, JSON.stringify(arr));
  } catch {
    // Ignore
  }
}

export function clearPersistedMessages(): void {
  try {
    localStorage.removeItem(PERSISTED_KEY);
  } catch {
    // Ignore
  }
}

// ── Extract text from message parts ──

function getMessageText(message: AutoArtifactMessage): string {
  return message.parts
    .filter((p) => p.type === "text" && p.text && p.text.trim().length > 0)
    .map((p) => p.text!.trim())
    .join("\n\n");
}

// ── Hook ──

/**
 * Automatically creates artifact records when chat messages complete.
 * Watches for completed assistant responses and persists them as artifacts
 * so they appear in the RECENT OUTPUTS dashboard section.
 */
export function useAutoArtifacts({
  messages,
  status,
  client,
  agentId,
  specialistId,
  sessionId,
  minContentLength = DEFAULT_MIN_CONTENT_LENGTH,
}: UseAutoArtifactsOptions): void {
  const lastStatusRef = useRef(status);
  const processingRef = useRef(false);

  useEffect(() => {
    const wasStreaming = lastStatusRef.current === "streaming" || lastStatusRef.current === "submitted";
    lastStatusRef.current = status;

    // Only act when chat transitions to "ready" (done streaming)
    if (status !== "ready") return;
    // Only act on transition from streaming/submitted — not on initial mount with ready status
    // unless there are already messages (e.g., session reload)
    if (!wasStreaming && messages.length === 0) return;
    if (!client || !agentId) return;
    if (processingRef.current) return;

    processingRef.current = true;

    const persisted = getPersistedMessageIds();
    const newMessageIds: string[] = [];

    for (const message of messages) {
      if (message.role !== "assistant") continue;
      if (persisted.has(message.id)) continue;

      const text = getMessageText(message);
      if (text.length < minContentLength) continue;
      if (!isStructuredContent(text)) continue;

      newMessageIds.push(message.id);

      // Fire-and-forget artifact creation
      void client
        .createArtifact({
          projectId: agentId,
          title: deriveArtifactTitle(text),
          type: inferArtifactType(text),
          format: "markdown",
          contentRef: `session:${sessionId}/message:${message.id}`,
          createdBy: specialistId || "cmo",
          content: text,
          summary: text.slice(0, 200),
        })
        .catch((err: unknown) => {
          console.error("[useAutoArtifacts] Failed to create artifact:", err);
        });
    }

    if (newMessageIds.length > 0) {
      markMessagesPersisted(newMessageIds);
    }

    processingRef.current = false;
  }, [messages, status, client, agentId, specialistId, sessionId, minContentLength]);
}
