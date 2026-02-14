import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  WikiPageContent,
  WikiPageResponse,
  WikiPageSummary,
  WikiPageUpdateResponse,
} from "./types";
import { deriveWikiTitle, normalizeWikiPath } from "./utils";

interface UseWikiPageControllerOptions {
  enabled: boolean;
  wikiPath: string | undefined;
  onNavigate: (wikiPath: string) => void;
  onAuthRequired: () => void;
}

interface WikiApiErrorPayload {
  error?: string;
  code?: string;
  pages?: WikiPageSummary[];
  wikiRoot?: string;
}

export interface WikiPageController {
  activePath: string;
  title: string;
  page: WikiPageContent | null;
  pages: WikiPageSummary[];
  wikiRootPath: string;
  error: string | null;
  isLoading: boolean;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  selectPage: (wikiPath: string) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  setDraft: (value: string) => void;
  save: () => Promise<void>;
}

export function useWikiPageController(
  options: UseWikiPageControllerOptions,
): WikiPageController {
  const { enabled, wikiPath, onNavigate, onAuthRequired } = options;
  const [page, setPage] = useState<WikiPageContent | null>(null);
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [wikiRootPath, setWikiRootPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setSaving] = useState(false);

  const activePath = useMemo(() => normalizeWikiPath(wikiPath), [wikiPath]);
  const title = page?.title ?? deriveWikiTitle(activePath);

  const loadWikiPage = useCallback(
    async (requestedPath: string): Promise<void> => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (requestedPath) {
        params.set("path", requestedPath);
      }
      const endpoint = params.toString()
        ? `/api/wiki/page?${params.toString()}`
        : "/api/wiki/page";

      try {
        const response = await fetch(endpoint);
        const payload = (await response.json().catch(() => {
          return null;
        })) as (Partial<WikiPageResponse> & WikiApiErrorPayload) | null;

        if (!response.ok) {
          if (response.status === 401 && payload?.code === "AUTH_REQUIRED") {
            onAuthRequired();
            setError("Authentication required. Sign in to continue.");
            return;
          }

          setPage(null);
          setPages(Array.isArray(payload?.pages) ? payload.pages : []);
          setWikiRootPath(
            typeof payload?.wikiRoot === "string" ? payload.wikiRoot : "",
          );
          setError(
            typeof payload?.error === "string"
              ? payload.error
              : `Request failed with ${response.status}`,
          );
          return;
        }

        const parsed = payload as WikiPageResponse;
        setWikiRootPath(parsed.wikiRoot);
        setPages(parsed.pages);
        setPage(parsed.page);
        setDraft(parsed.page.content);
        setEditing(false);

        const canonicalPath = normalizeWikiPath(parsed.page.path);
        if (canonicalPath !== requestedPath) {
          onNavigate(canonicalPath);
        }
      } catch (requestError) {
        setPage(null);
        setPages([]);
        setWikiRootPath("");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load wiki page.",
        );
      } finally {
        setLoading(false);
      }
    },
    [onAuthRequired, onNavigate],
  );

  useEffect(() => {
    if (!enabled) {
      setEditing(false);
      return;
    }

    void loadWikiPage(activePath);
  }, [enabled, activePath, loadWikiPage]);

  const selectPage = useCallback(
    (nextWikiPath: string): void => {
      onNavigate(normalizeWikiPath(nextWikiPath));
    },
    [onNavigate],
  );

  const startEditing = useCallback((): void => {
    setDraft(page?.content ?? "");
    setEditing(true);
    setError(null);
  }, [page]);

  const cancelEditing = useCallback((): void => {
    setEditing(false);
    setDraft(page?.content ?? "");
    setError(null);
  }, [page]);

  const save = useCallback(async (): Promise<void> => {
    if (!enabled || !page) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/wiki/page", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          path: activePath,
          content: draft,
        }),
      });
      const payload = (await response.json().catch(() => {
        return null;
      })) as (WikiPageUpdateResponse & WikiApiErrorPayload) | null;

      if (!response.ok) {
        if (response.status === 401 && payload?.code === "AUTH_REQUIRED") {
          onAuthRequired();
          throw new Error("Authentication required. Sign in to continue.");
        }
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Request failed with ${response.status}`,
        );
      }

      const parsed = payload as WikiPageUpdateResponse;
      setWikiRootPath(parsed.wikiRoot);
      setPages(parsed.pages);
      setPage(parsed.page);
      setDraft(parsed.page.content);
      setEditing(false);

      const canonicalPath = normalizeWikiPath(parsed.page.path);
      if (canonicalPath !== activePath) {
        onNavigate(canonicalPath);
      }

      toast.success(parsed.message ?? "Wiki page updated.");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to update wiki page.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activePath, draft, enabled, onAuthRequired, onNavigate, page]);

  return {
    activePath,
    title,
    page,
    pages,
    wikiRootPath,
    error,
    isLoading,
    isEditing,
    draft,
    isSaving,
    selectPage,
    startEditing,
    cancelEditing,
    setDraft,
    save,
  };
}
