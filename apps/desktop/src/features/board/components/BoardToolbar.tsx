import { ArrowUpDownIcon, FilterIcon, FilterXIcon, LayersIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
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
  FILTER_OPTIONS,
  SORT_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  type BoardSort,
  type SourceTypeFilter,
  type StatusFilter,
} from "@/features/board/lib/board-filters";
import { GROUPING_OPTIONS, type BoardGrouping } from "@/features/board/lib/board-grouping";

interface BoardToolbarProps {
  filter: StatusFilter;
  sort: BoardSort;
  search: string;
  grouping: BoardGrouping;
  sourceType: SourceTypeFilter | null;
  stale: boolean;
  activeFilterCount: number;
  onFilterChange: (filter: StatusFilter) => void;
  onSortChange: (sort: BoardSort) => void;
  onSearchChange: (search: string) => void;
  onGroupingChange: (grouping: BoardGrouping) => void;
  onSourceTypeChange: (sourceType: SourceTypeFilter | null) => void;
  onStaleChange: (stale: boolean) => void;
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
  sourceType,
  stale,
  activeFilterCount,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onGroupingChange,
  onSourceTypeChange,
  onStaleChange,
  onClearFilters,
  onRefresh,
  totalCount,
  filteredCount,
}: BoardToolbarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
  const currentGroupingLabel =
    GROUPING_OPTIONS.find((o) => o.value === grouping)?.label ?? "Group";
  const hasAdvancedFilters = sourceType !== null || stale;

  return (
    <div className="flex flex-col gap-2">
      {/* Single row: status tabs + search + controls */}
      <div className="flex items-center gap-3">
        {/* Status filter tabs — pill-style active state */}
        <div className="flex items-center gap-0.5">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              aria-pressed={filter === option.value}
              className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-all ${
                filter === option.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/60 hover:bg-muted/60 hover:text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-border" />

        {/* Search input */}
        <InputGroup className="w-52">
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] tabular-nums text-muted-foreground/50">
            {filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? 'task' : 'tasks'}`
              : `${filteredCount} of ${totalCount} ${totalCount === 1 ? 'task' : 'tasks'}`}
          </span>

          {/* Advanced filters toggle */}
          <Button
            variant={showAdvanced || hasAdvancedFilters ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <FilterIcon className="size-3" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
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
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]">
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
            className="rounded-md p-1.5 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Refresh tasks"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Underline separator */}
      <div className="h-px bg-border" />

      {/* Advanced filter row — collapsible */}
      {(showAdvanced || hasAdvancedFilters) && (
        <div className="flex items-center gap-2 pb-1">
          {/* Source type pills */}
          <div className="flex items-center gap-0.5">
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
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                  sourceType === option.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Toggle chips */}
          <button
            type="button"
            onClick={() => onStaleChange(!stale)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
              stale
                ? "bg-warning/10 text-warning"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            Stale
          </button>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              <FilterXIcon className="size-3" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
