import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const useBoardFiltersSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/hooks/useBoardFilters.ts",
  ),
  "utf-8",
);

const boardFiltersSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/lib/board-filters.ts",
  ),
  "utf-8",
);

const boardToolbarSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardToolbar.tsx",
  ),
  "utf-8",
);

const boardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardWorkspace.tsx",
  ),
  "utf-8",
);

describe("Extended board filter system", () => {
  describe("BoardFilterState type", () => {
    it("defines a BoardFilterState interface with all filter dimensions", () => {
      expect(boardFiltersSrc).toContain("interface BoardFilterState");
      expect(boardFiltersSrc).toContain("status: StatusFilter");
      expect(boardFiltersSrc).toContain("objectiveId: string | null");
      expect(boardFiltersSrc).toContain("runId: string | null");
      expect(boardFiltersSrc).toContain("sourceType: SourceTypeFilter | null");
      expect(boardFiltersSrc).toContain("stale: boolean");
      expect(boardFiltersSrc).toContain("readyForReview: boolean");
    });

    it("exports DEFAULT_FILTER_STATE with safe defaults", () => {
      expect(boardFiltersSrc).toContain("DEFAULT_FILTER_STATE");
      expect(boardFiltersSrc).toMatch(/status:\s*"all"/);
      expect(boardFiltersSrc).toMatch(/objectiveId:\s*null/);
      expect(boardFiltersSrc).toMatch(/stale:\s*false/);
      expect(boardFiltersSrc).toMatch(/readyForReview:\s*false/);
    });

    it("exports sourceTypeEnum options for UI", () => {
      expect(boardFiltersSrc).toContain("SOURCE_TYPE_OPTIONS");
      expect(boardFiltersSrc).toContain('"chat"');
      expect(boardFiltersSrc).toContain('"playbook"');
      expect(boardFiltersSrc).toContain('"action"');
      expect(boardFiltersSrc).toContain('"manual"');
    });
  });

  describe("applyBoardFilters pipeline", () => {
    it("accepts BoardFilterState as second argument", () => {
      expect(boardFiltersSrc).toMatch(
        /function applyBoardFilters[\s\S]*?filterState:\s*BoardFilterState/,
      );
    });

    it("supports optional now parameter for stale calculation", () => {
      expect(boardFiltersSrc).toMatch(
        /function applyBoardFilters[\s\S]*?now\?:\s*Date/,
      );
    });
  });

  describe("isStale helper", () => {
    it("is exported", () => {
      expect(boardFiltersSrc).toContain("export function isStale");
    });
  });

  describe("isReadyForReview helper", () => {
    it("is exported", () => {
      expect(boardFiltersSrc).toContain("export function isReadyForReview");
    });
  });

  describe("useBoardFilters hook", () => {
    it("exposes setters for each filter dimension", () => {
      expect(useBoardFiltersSrc).toContain("setObjectiveFilter");
      expect(useBoardFiltersSrc).toContain("setRunFilter");
      expect(useBoardFiltersSrc).toContain("setSourceTypeFilter");
      expect(useBoardFiltersSrc).toContain("setStaleFilter");
      expect(useBoardFiltersSrc).toContain("setReadyForReviewFilter");
    });

    it("exposes clearFilters function", () => {
      expect(useBoardFiltersSrc).toContain("clearFilters");
    });

    it("exposes activeFilterCount", () => {
      expect(useBoardFiltersSrc).toContain("activeFilterCount");
    });

    it("parses hash objective param on init", () => {
      expect(useBoardFiltersSrc).toContain("parseHashObjectiveId");
      expect(useBoardFiltersSrc).toContain("window.location.hash");
    });

    it("syncs objective filter to URL hash", () => {
      expect(useBoardFiltersSrc).toContain("objective=");
      expect(useBoardFiltersSrc).toContain("hashchange");
    });

    it("still defaults to 'all' status filter and 'status' sort", () => {
      expect(useBoardFiltersSrc).toContain("DEFAULT_FILTER_STATE");
      expect(useBoardFiltersSrc).toContain('useState<BoardSort>("status")');
    });
  });

  describe("BoardToolbar", () => {
    it("renders objective dropdown filter", () => {
      expect(boardToolbarSrc).toContain("All Objectives");
      expect(boardToolbarSrc).toContain("onObjectiveChange");
    });

    it("renders source type filter pills", () => {
      expect(boardToolbarSrc).toContain("SOURCE_TYPE_OPTIONS");
      expect(boardToolbarSrc).toContain("onSourceTypeChange");
    });

    it("renders stale toggle chip", () => {
      expect(boardToolbarSrc).toContain("Stale");
      expect(boardToolbarSrc).toContain("onStaleChange");
    });

    it("renders needs review toggle chip", () => {
      expect(boardToolbarSrc).toContain("Needs Review");
      expect(boardToolbarSrc).toContain("onReadyForReviewChange");
    });

    it("renders clear filters button with count", () => {
      expect(boardToolbarSrc).toContain("onClearFilters");
      expect(boardToolbarSrc).toContain("activeFilterCount");
      expect(boardToolbarSrc).toContain("FilterXIcon");
    });
  });

  describe("BoardWorkspace", () => {
    it("uses useObjectiveList hook", () => {
      expect(boardWorkspaceSrc).toContain("useObjectiveList");
    });

    it("passes all filter props to BoardToolbar", () => {
      expect(boardWorkspaceSrc).toContain("objectiveId={filterState.objectiveId}");
      expect(boardWorkspaceSrc).toContain("sourceType={filterState.sourceType}");
      expect(boardWorkspaceSrc).toContain("stale={filterState.stale}");
      expect(boardWorkspaceSrc).toContain("readyForReview={filterState.readyForReview}");
    });
  });
});
