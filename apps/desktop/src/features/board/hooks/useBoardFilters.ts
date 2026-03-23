import { useState, useMemo, useEffect, useCallback } from "react";
import type { TaskRecord } from "@opengoat/contracts";
import {
  applyBoardFilters,
  DEFAULT_FILTER_STATE,
  type BoardFilterState,
  type BoardSort,
  type SourceTypeFilter,
  type StatusFilter,
} from "@/features/board/lib/board-filters";
import {
  groupTasks,
  type BoardGrouping,
  type ObjectiveMapEntry,
  type RunMapEntry,
  type TaskGroup,
} from "@/features/board/lib/board-grouping";

/** @deprecated Use StatusFilter instead */
export type BoardFilter = StatusFilter;

export interface UseBoardFiltersResult {
  filteredTasks: TaskRecord[];
  groupedTasks: TaskGroup[];
  grouping: BoardGrouping;
  filterState: BoardFilterState;
  filter: StatusFilter;
  sort: BoardSort;
  search: string;
  setFilter: (filter: StatusFilter) => void;
  setSort: (sort: BoardSort) => void;
  setSearch: (search: string) => void;
  setGrouping: (grouping: BoardGrouping) => void;
  setObjectiveFilter: (objectiveId: string | null) => void;
  setRunFilter: (runId: string | null) => void;
  setSourceTypeFilter: (sourceType: SourceTypeFilter | null) => void;
  setStaleFilter: (stale: boolean) => void;
  setReadyForReviewFilter: (readyForReview: boolean) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

function parseHashObjectiveId(): string | null {
  try {
    const hash = window.location.hash;
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    return params.get("objective") || null;
  } catch {
    return null;
  }
}

export function useBoardFilters(
  tasks: TaskRecord[],
  objectiveMap: Map<string, ObjectiveMapEntry> = new Map(),
  runMap: Map<string, RunMapEntry> = new Map(),
): UseBoardFiltersResult {
  const [filterState, setFilterState] = useState<BoardFilterState>(() => {
    const hashObjective = parseHashObjectiveId();
    return {
      ...DEFAULT_FILTER_STATE,
      ...(hashObjective ? { objectiveId: hashObjective } : {}),
    };
  });
  const [sort, setSort] = useState<BoardSort>("status");
  const [search, setSearch] = useState("");
  const [grouping, setGrouping] = useState<BoardGrouping>("none");

  // Sync objective filter to URL hash
  useEffect(() => {
    const hash = window.location.hash;
    const baseHash = hash.split("?")[0] || "";
    if (filterState.objectiveId) {
      const newHash = `${baseHash}?objective=${encodeURIComponent(filterState.objectiveId)}`;
      if (window.location.hash !== newHash) {
        window.location.hash = newHash;
      }
    } else {
      // Remove objective param from hash if present
      if (hash.includes("objective=")) {
        window.location.hash = baseHash;
      }
    }
  }, [filterState.objectiveId]);

  // Listen for hashchange to pick up external navigation
  useEffect(() => {
    const handler = () => {
      const hashObjective = parseHashObjectiveId();
      setFilterState((prev) => {
        if (prev.objectiveId === hashObjective) return prev;
        return { ...prev, objectiveId: hashObjective };
      });
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const filteredTasks = useMemo(
    () => applyBoardFilters(tasks, filterState, sort, search),
    [tasks, filterState, sort, search],
  );

  const groupedTasks = useMemo(
    () => groupTasks(filteredTasks, grouping, objectiveMap, runMap),
    [filteredTasks, grouping, objectiveMap, runMap],
  );

  const setFilter = useCallback((status: StatusFilter) => {
    setFilterState((prev) => ({ ...prev, status }));
  }, []);

  const setObjectiveFilter = useCallback((objectiveId: string | null) => {
    setFilterState((prev) => ({ ...prev, objectiveId }));
  }, []);

  const setRunFilter = useCallback((runId: string | null) => {
    setFilterState((prev) => ({ ...prev, runId }));
  }, []);

  const setSourceTypeFilter = useCallback((sourceType: SourceTypeFilter | null) => {
    setFilterState((prev) => ({ ...prev, sourceType }));
  }, []);

  const setStaleFilter = useCallback((stale: boolean) => {
    setFilterState((prev) => ({ ...prev, stale }));
  }, []);

  const setReadyForReviewFilter = useCallback((readyForReview: boolean) => {
    setFilterState((prev) => ({ ...prev, readyForReview }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTER_STATE);
    setSearch("");
    setGrouping("none");
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterState.status !== "all") count++;
    if (filterState.objectiveId) count++;
    if (filterState.runId) count++;
    if (filterState.sourceType) count++;
    if (filterState.stale) count++;
    if (filterState.readyForReview) count++;
    if (search.trim()) count++;
    return count;
  }, [filterState, search]);

  return {
    filteredTasks,
    groupedTasks,
    grouping,
    filterState,
    filter: filterState.status,
    sort,
    search,
    setFilter,
    setSort,
    setSearch,
    setGrouping,
    setObjectiveFilter,
    setRunFilter,
    setSourceTypeFilter,
    setStaleFilter,
    setReadyForReviewFilter,
    clearFilters,
    activeFilterCount,
  };
}
