import { ArrowUpDownIcon, FilterXIcon, LayersIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FILTER_OPTIONS,
  SORT_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  type BoardSort,
  type SourceTypeFilter,
  type StatusFilter,
} from "@/features/board/lib/board-filters";
import { GROUPING_OPTIONS, type BoardGrouping } from "@/features/board/lib/board-grouping";
import type { ObjectiveOption } from "@/features/board/hooks/useObjectiveList";

interface BoardToolbarProps {
  filter: StatusFilter;
  sort: BoardSort;
  search: string;
  grouping: BoardGrouping;
  objectiveId: string | null;
  sourceType: SourceTypeFilter | null;
  stale: boolean;
  readyForReview: boolean;
  activeFilterCount: number;
  objectives: ObjectiveOption[];
  onFilterChange: (filter: StatusFilter) => void;
  onSortChange: (sort: BoardSort) => void;
  onSearchChange: (search: string) => void;
  onGroupingChange: (grouping: BoardGrouping) => void;
  onObjectiveChange: (objectiveId: string | null) => void;
  onSourceTypeChange: (sourceType: SourceTypeFilter | null) => void;
  onStaleChange: (stale: boolean) => void;
  onReadyForReviewChange: (readyForReview: boolean) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  totalCount: number;
  filteredCount: number;
}

export function BoardToolbar({
  filter,
  sort,
  search,
  grouping,
  objectiveId,
  sourceType,
  stale,
  readyForReview,
  activeFilterCount,
  objectives,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onGroupingChange,
  onObjectiveChange,
  onSourceTypeChange,
  onStaleChange,
  onReadyForReviewChange,
  onClearFilters,
  onRefresh,
  totalCount,
  filteredCount,
}: BoardToolbarProps) {
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
  const currentGroupingLabel =
    GROUPING_OPTIONS.find((o) => o.value === grouping)?.label ?? "Group";

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: status pills + search + count + sort + refresh */}
      <div className="flex items-center justify-between gap-3">
        {/* Left group: filter pills + search */}
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFilterChange(option.value)}
                aria-pressed={filter === option.value}
                className={`rounded-md px-3 py-1 font-mono text-[11px] font-medium tracking-wide transition-all ${
                  filter === option.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <InputGroup className="w-48">
            <InputGroupAddon align="inline-start">
              <SearchIcon className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search"
                >
                  <XIcon className="size-3" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* Right group: task count, sort dropdown, refresh */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
            {filteredCount === totalCount
              ? `${totalCount} tasks`
              : `${filteredCount} of ${totalCount} tasks`}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px]">
                <LayersIcon className="size-3" />
                {currentGroupingLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={grouping}
                onValueChange={(value) => onGroupingChange(value as BoardGrouping)}
              >
                {GROUPING_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px]">
                <ArrowUpDownIcon className="size-3" />
                {currentSortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => onSortChange(value as BoardSort)}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Refresh tasks"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: objective dropdown + source type pills + toggle chips + clear */}
      <div className="flex items-center gap-2">
        {/* Objective dropdown */}
        {objectives.length > 0 && (
          <Select
            value={objectiveId ?? "__all__"}
            onValueChange={(value) =>
              onObjectiveChange(value === "__all__" ? null : value)
            }
          >
            <SelectTrigger className="h-7 w-44 text-[11px]">
              <SelectValue placeholder="All Objectives" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Objectives</SelectItem>
              {objectives.map((obj) => (
                <SelectItem key={obj.objectiveId} value={obj.objectiveId}>
                  {obj.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Source type filter pills */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => onSourceTypeChange(null)}
            aria-pressed={sourceType === null}
            className={`rounded-md px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide transition-all ${
              sourceType === null
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {SOURCE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onSourceTypeChange(
                  sourceType === option.value ? null : option.value,
                )
              }
              aria-pressed={sourceType === option.value}
              className={`rounded-md px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide transition-all ${
                sourceType === option.value
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Toggle chips */}
        <button
          type="button"
          onClick={() => onStaleChange(!stale)}
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide transition-all ${
            stale
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          Stale
        </button>

        <button
          type="button"
          onClick={() => onReadyForReviewChange(!readyForReview)}
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide transition-all ${
            readyForReview
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          Needs Review
        </button>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FilterXIcon className="size-3" />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  );
}
