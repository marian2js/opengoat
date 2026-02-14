export function normalizeWikiPath(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
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

export function deriveWikiTitle(wikiPath: string | undefined): string {
  const normalized = normalizeWikiPath(wikiPath);
  if (!normalized) {
    return "Wiki";
  }

  const lastSegment = normalized.split("/").pop() ?? "";
  if (!lastSegment) {
    return "Wiki";
  }

  return lastSegment
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
