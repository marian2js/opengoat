import { ArrowUpDownIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
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
  type BoardFilter,
  type BoardSort,
} from "@/features/board/lib/board-filters";

interface BoardToolbarProps {
  filter: BoardFilter;
  sort: BoardSort;
  search: string;
  onFilterChange: (filter: BoardFilter) => void;
  onSortChange: (sort: BoardSort) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  totalCount: number;
  filteredCount: number;
}

export function BoardToolbar({
  filter,
  sort,
  search,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onRefresh,
  totalCount,
  filteredCount,
}: BoardToolbarProps) {
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left group: filter pills + search */}
      <div className="flex items-center gap-2">
        {/* Filter pills */}
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onFilterChange(option.value)}
              aria-pressed={filter === option.value}
            >
              {option.label}
            </Button>
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
        <span className="text-xs text-muted-foreground">
          {filteredCount === totalCount
            ? `${totalCount} tasks`
            : `${filteredCount} of ${totalCount} tasks`}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDownIcon className="size-3.5" />
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
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Refresh tasks"
        >
          <RefreshCwIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
