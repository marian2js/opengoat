/**
 * Tracks last-updated timestamps for Brain page sections using localStorage.
 * Since the workspace file API doesn't include modification timestamps,
 * we record them on the frontend when files are written and detect
 * external changes (e.g. from Refine context) via content hashing.
 */

const STORAGE_KEY = "opengoat:brain-section-timestamps";

interface SectionRecord {
  timestamp: string; // ISO date string
  contentHash: number; // djb2 hash of content
}

type TimestampStore = Record<string, SectionRecord>;

function makeKey(agentId: string, filename: string): string {
  return `${agentId}:${filename}`;
}

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // unsigned 32-bit
}

function readStore(): TimestampStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TimestampStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: TimestampStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Get the last-updated timestamp for a brain section.
 * Returns an ISO date string or null if no timestamp has been recorded.
 */
export function getSectionTimestamp(agentId: string, filename: string): string | null {
  const store = readStore();
  return store[makeKey(agentId, filename)]?.timestamp ?? null;
}

/**
 * Record the current time as the last-updated timestamp for a brain section.
 */
export function setSectionTimestamp(agentId: string, filename: string): void {
  const store = readStore();
  const key = makeKey(agentId, filename);
  const existing = store[key];
  store[key] = {
    timestamp: new Date().toISOString(),
    contentHash: existing?.contentHash ?? 0,
  };
  writeStore(store);
}

/**
 * Store a content hash for detecting external modifications.
 */
export function setContentHash(agentId: string, filename: string, content: string): void {
  const store = readStore();
  const key = makeKey(agentId, filename);
  const existing = store[key];
  store[key] = {
    timestamp: existing?.timestamp ?? new Date().toISOString(),
    contentHash: djb2Hash(content),
  };
  writeStore(store);
}

/**
 * Check if the current content differs from the last recorded hash.
 * Returns true if the content has changed or if no hash was previously stored.
 */
export function hasContentChanged(agentId: string, filename: string, content: string): boolean {
  const store = readStore();
  const record = store[makeKey(agentId, filename)];
  if (!record) return true;
  return record.contentHash !== djb2Hash(content);
}
