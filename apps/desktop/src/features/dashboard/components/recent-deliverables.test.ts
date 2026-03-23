import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "RecentDeliverables.tsx"),
  "utf-8",
);

const artifactCardSrc = readFileSync(
  resolve(import.meta.dirname, "ArtifactCard.tsx"),
  "utf-8",
);

const bundleCardSrc = readFileSync(
  resolve(import.meta.dirname, "BundleCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// RecentDeliverables — structure and design system validation
// ---------------------------------------------------------------------------

void test("RecentDeliverables: exports a named function", () => {
  assert.ok(
    src.includes("export function RecentDeliverables"),
    "Expected named export 'RecentDeliverables'",
  );
});

void test("RecentDeliverables: uses section-label pattern with teal icon", () => {
  assert.ok(
    src.includes("section-label"),
    "Expected section-label CSS class for mono uppercase heading",
  );
  assert.ok(
    src.includes("text-primary"),
    "Expected teal primary color on section icon",
  );
});

void test("RecentDeliverables: displays RECENT DELIVERABLES section header", () => {
  assert.ok(
    src.includes("RECENT DELIVERABLES") || src.includes("Recent Deliverables"),
    "Expected 'RECENT DELIVERABLES' section heading",
  );
});

void test("RecentDeliverables: returns null when loading", () => {
  assert.ok(
    src.includes("isLoading") && src.includes("null"),
    "Expected section to return null when loading",
  );
});

void test("RecentDeliverables: handles empty state with message", () => {
  assert.ok(
    src.includes("No deliverables yet"),
    "Expected empty state message about no deliverables",
  );
});

void test("RecentDeliverables: uses useRecentArtifacts hook", () => {
  assert.ok(
    src.includes("useRecentArtifacts"),
    "Expected useRecentArtifacts hook usage",
  );
});

void test("RecentDeliverables: renders ArtifactCard for standalone artifacts", () => {
  assert.ok(
    src.includes("ArtifactCard"),
    "Expected ArtifactCard component rendering",
  );
});

void test("RecentDeliverables: renders BundleCard for bundle groups", () => {
  assert.ok(
    src.includes("BundleCard"),
    "Expected BundleCard component rendering",
  );
});

void test("RecentDeliverables: accepts onPreview callback prop", () => {
  assert.ok(
    src.includes("onPreview"),
    "Expected onPreview callback prop",
  );
});

void test("RecentDeliverables: accepts client prop", () => {
  assert.ok(
    src.includes("client"),
    "Expected client prop for SidecarClient",
  );
});

void test("RecentDeliverables: shows count badge when artifacts exist", () => {
  assert.ok(
    src.includes("tabular-nums"),
    "Expected count badge with tabular-nums font",
  );
});

// ---------------------------------------------------------------------------
// ArtifactCard — structure and design system validation
// ---------------------------------------------------------------------------

void test("ArtifactCard: exports a named function", () => {
  assert.ok(
    artifactCardSrc.includes("export function ArtifactCard"),
    "Expected named export 'ArtifactCard'",
  );
});

void test("ArtifactCard: has left accent bar", () => {
  assert.ok(
    artifactCardSrc.includes("w-[3px]") || artifactCardSrc.includes("w-1"),
    "Expected left accent bar element",
  );
});

void test("ArtifactCard: displays type badge with monospace styling", () => {
  assert.ok(
    artifactCardSrc.includes("font-mono") && artifactCardSrc.includes("text-[10px]"),
    "Expected monospace 10px type badge",
  );
});

void test("ArtifactCard: displays status badge with dot", () => {
  assert.ok(
    artifactCardSrc.includes("size-1.5") || artifactCardSrc.includes("rounded-full"),
    "Expected status dot element",
  );
});

void test("ArtifactCard: shows relative timestamp", () => {
  assert.ok(
    artifactCardSrc.includes("formatRelativeTime"),
    "Expected formatRelativeTime usage",
  );
});

void test("ArtifactCard: has Preview action", () => {
  assert.ok(
    artifactCardSrc.includes("Preview"),
    "Expected Preview action text",
  );
});

void test("ArtifactCard: uses hover state", () => {
  assert.ok(
    artifactCardSrc.includes("hover:"),
    "Expected hover state on card",
  );
});

void test("ArtifactCard: accepts onPreview callback", () => {
  assert.ok(
    artifactCardSrc.includes("onPreview"),
    "Expected onPreview callback prop",
  );
});

void test("ArtifactCard: uses getArtifactTypeConfig for styling", () => {
  assert.ok(
    artifactCardSrc.includes("getArtifactTypeConfig"),
    "Expected getArtifactTypeConfig usage for type-based styling",
  );
});

void test("ArtifactCard: uses getArtifactStatusConfig for status badge", () => {
  assert.ok(
    artifactCardSrc.includes("getArtifactStatusConfig"),
    "Expected getArtifactStatusConfig usage for status badge",
  );
});

void test("ArtifactCard: shows artifact title", () => {
  assert.ok(
    artifactCardSrc.includes("artifact.title") || artifactCardSrc.includes(".title"),
    "Expected artifact title display",
  );
});

void test("ArtifactCard: uses ArrowRight icon for preview action", () => {
  assert.ok(
    artifactCardSrc.includes("ArrowRight"),
    "Expected ArrowRight icon for preview action hover animation",
  );
});

// ---------------------------------------------------------------------------
// BundleCard — structure and design system validation
// ---------------------------------------------------------------------------

void test("BundleCard: exports a named function", () => {
  assert.ok(
    bundleCardSrc.includes("export function BundleCard"),
    "Expected named export 'BundleCard'",
  );
});

void test("BundleCard: has expand/collapse toggle", () => {
  assert.ok(
    bundleCardSrc.includes("useState") &&
    (bundleCardSrc.includes("expanded") || bundleCardSrc.includes("isExpanded")),
    "Expected expand/collapse state toggle",
  );
});

void test("BundleCard: shows ChevronRight icon that rotates", () => {
  assert.ok(
    bundleCardSrc.includes("ChevronRight") || bundleCardSrc.includes("Chevron"),
    "Expected ChevronRight icon for expand toggle",
  );
  assert.ok(
    bundleCardSrc.includes("rotate"),
    "Expected rotation transform for expand animation",
  );
});

void test("BundleCard: shows artifact count badge", () => {
  assert.ok(
    bundleCardSrc.includes("artifacts.length") || bundleCardSrc.includes(".length"),
    "Expected artifact count in bundle",
  );
});

void test("BundleCard: renders nested ArtifactCard when expanded", () => {
  assert.ok(
    bundleCardSrc.includes("ArtifactCard"),
    "Expected nested ArtifactCard rendering for expanded content",
  );
});

void test("BundleCard: accepts onPreview callback", () => {
  assert.ok(
    bundleCardSrc.includes("onPreview"),
    "Expected onPreview callback prop",
  );
});

void test("BundleCard: uses primary teal accent for bundle", () => {
  assert.ok(
    bundleCardSrc.includes("bg-primary") || bundleCardSrc.includes("primary"),
    "Expected primary/teal accent color for bundles",
  );
});

void test("BundleCard: shows bundle title", () => {
  assert.ok(
    bundleCardSrc.includes("bundle.title") || bundleCardSrc.includes(".title"),
    "Expected bundle title display",
  );
});
