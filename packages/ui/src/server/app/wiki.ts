import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface WikiPageSummary {
  path: string;
  href: string;
  title: string;
  sourcePath: string;
  updatedAt: number;
}

interface WikiPageCandidate extends WikiPageSummary {
  isIndex: boolean;
}

export interface WikiPageContent extends WikiPageSummary {
  content: string;
}

export interface WikiPagesSnapshot {
  wikiRoot: string;
  pages: WikiPageSummary[];
}

interface WikiPagesSnapshotInternal {
  wikiRoot: string;
  pages: WikiPageCandidate[];
}

export function resolveWikiRoot(homeDir: string): string {
  return path.resolve(homeDir, "organization", "wiki");
}

export function normalizeWikiPath(input: string | undefined): string {
  const trimmed = input?.trim() ?? "";
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const normalized = trimmed
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/").map((segment) => segment.trim());
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => !segment || segment === "." || segment === "..",
    )
  ) {
    return "";
  }

  return segments.join("/");
}

export function wikiPathToHref(wikiPath: string): string {
  const normalized = normalizeWikiPath(wikiPath);
  if (!normalized) {
    return "/wiki";
  }
  return `/wiki/${normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export async function listWikiPages(homeDir: string): Promise<WikiPagesSnapshot> {
  const snapshot = await buildWikiPagesSnapshot(homeDir);
  return {
    wikiRoot: snapshot.wikiRoot,
    pages: snapshot.pages.map((page) => toWikiSummary(page)),
  };
}

export async function readWikiPageByPath(
  homeDir: string,
  requestedPath: string | undefined,
): Promise<{
  wikiRoot: string;
  pages: WikiPageSummary[];
  requestedPath: string;
  page: WikiPageContent | null;
}> {
  const normalizedPath = normalizeWikiPath(requestedPath);
  const snapshot = await buildWikiPagesSnapshot(homeDir);
  const summaryPages = snapshot.pages.map((page) => toWikiSummary(page));
  const matched = snapshot.pages.find((page) => page.path === normalizedPath);

  if (!matched) {
    return {
      wikiRoot: snapshot.wikiRoot,
      pages: summaryPages,
      requestedPath: normalizedPath,
      page: null,
    };
  }

  const content = await readFile(matched.sourcePath, "utf8");
  return {
    wikiRoot: snapshot.wikiRoot,
    pages: summaryPages,
    requestedPath: normalizedPath,
    page: {
      ...toWikiSummary(matched),
      content,
    },
  };
}

export async function updateWikiPageByPath(
  homeDir: string,
  requestedPath: string | undefined,
  content: string,
): Promise<{
  wikiRoot: string;
  pages: WikiPageSummary[];
  requestedPath: string;
  page: WikiPageContent | null;
}> {
  const resolved = await readWikiPageByPath(homeDir, requestedPath);
  if (!resolved.page) {
    return resolved;
  }

  await writeFile(resolved.page.sourcePath, content, "utf8");
  return readWikiPageByPath(homeDir, resolved.page.path);
}

async function buildWikiPagesSnapshot(
  homeDir: string,
): Promise<WikiPagesSnapshotInternal> {
  const wikiRoot = resolveWikiRoot(homeDir);
  const rootStats = await stat(wikiRoot).catch(() => {
    return null;
  });
  if (!rootStats?.isDirectory()) {
    return {
      wikiRoot,
      pages: [],
    };
  }

  const markdownFiles = await collectMarkdownFiles(wikiRoot);
  const byPath = new Map<string, WikiPageCandidate>();

  for (const filePath of markdownFiles) {
    const relative = path.relative(wikiRoot, filePath).split(path.sep).join("/");
    if (!relative || relative.startsWith("../")) {
      continue;
    }
    const lowerRelative = relative.toLowerCase();
    if (!lowerRelative.endsWith(".md")) {
      continue;
    }

    const isIndex = path.posix.basename(lowerRelative) === "index.md";
    const routePath = isIndex
      ? normalizeWikiPath(path.posix.dirname(relative))
      : normalizeWikiPath(relative.slice(0, -3));
    const raw = await readFile(filePath, "utf8");
    const sourceStats = await stat(filePath);
    const fallbackTitle = deriveWikiTitle(routePath);
    const title = extractWikiTitle(raw) ?? fallbackTitle;

    const candidate: WikiPageCandidate = {
      path: routePath === "." ? "" : routePath,
      href: wikiPathToHref(routePath),
      title,
      sourcePath: filePath,
      updatedAt: sourceStats.mtimeMs,
      isIndex,
    };
    const existing = byPath.get(candidate.path);
    if (!existing || shouldReplaceWikiPage(existing, candidate)) {
      byPath.set(candidate.path, candidate);
    }
  }

  const pages = [...byPath.values()].sort((left, right) => {
    if (left.path === right.path) {
      return left.sourcePath.localeCompare(right.sourcePath);
    }
    if (left.path === "") {
      return -1;
    }
    if (right.path === "") {
      return 1;
    }
    return left.path.localeCompare(right.path);
  });

  return {
    wikiRoot,
    pages,
  };
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => {
    return [];
  });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files;
}

function shouldReplaceWikiPage(
  existing: WikiPageCandidate,
  next: WikiPageCandidate,
): boolean {
  if (existing.isIndex !== next.isIndex) {
    return next.isIndex;
  }

  return next.sourcePath.localeCompare(existing.sourcePath) < 0;
}

function extractWikiTitle(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  const title = match?.[1]?.trim();
  return title || undefined;
}

function deriveWikiTitle(routePath: string): string {
  if (!routePath) {
    return "Wiki";
  }

  const segment = routePath.split("/").pop()?.trim() ?? "";
  if (!segment) {
    return "Wiki";
  }

  return segment
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toWikiSummary(page: WikiPageCandidate): WikiPageSummary {
  return {
    path: page.path,
    href: page.href,
    title: page.title,
    sourcePath: page.sourcePath,
    updatedAt: page.updatedAt,
  };
}
