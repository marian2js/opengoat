import { useState, useMemo } from "react";
import type { TaskRecord } from "@opengoat/contracts";
import {
  applyBoardFilters,
  type BoardFilter,
  type BoardSort,
} from "@/features/board/lib/board-filters";

export interface UseBoardFiltersResult {
  filteredTasks: TaskRecord[];
  filter: BoardFilter;
  sort: BoardSort;
  search: string;
  setFilter: (filter: BoardFilter) => void;
  setSort: (sort: BoardSort) => void;
  setSearch: (search: string) => void;
}

export function useBoardFilters(tasks: TaskRecord[]): UseBoardFiltersResult {
  const [filter, setFilter] = useState<BoardFilter>("open");
  const [sort, setSort] = useState<BoardSort>("updated");
  const [search, setSearch] = useState("");

  const filteredTasks = useMemo(
    () => applyBoardFilters(tasks, filter, sort, search),
    [tasks, filter, sort, search],
  );

  return {
    filteredTasks,
    filter,
    sort,
    search,
    setFilter,
    setSort,
    setSearch,
  };
}
