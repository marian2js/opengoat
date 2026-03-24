import type { SidecarClient } from "@/lib/sidecar/client";
import { useArtifact } from "@/features/artifacts/hooks/useArtifact";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./ArtifactStatusBadge";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";
import {
  AlertCircleIcon,
  RefreshCwIcon,
  UserIcon,
  CalendarIcon,
  FileTextIcon,
  TagIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Format display names
// ---------------------------------------------------------------------------

const FORMAT_LABELS: Record<string, string> = {
  markdown: "Markdown",
  json: "JSON",
  csv: "CSV",
  txt: "Plain Text",
  html: "HTML",
  url: "URL",
  "file-ref": "File",
};

function formatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format;
}

function titleCase(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtifactReviewPanelProps {
  artifactId: string | null;
  client: SidecarClient;
  open: boolean;
  onClose: () => void;
  onArtifactUpdated?: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArtifactReviewPanel({
  artifactId,
  client,
  open,
  onClose,
}: ArtifactReviewPanelProps) {
  const { artifact, isLoading, error, refresh } = useArtifact(
    open ? artifactId : null,
    client,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-lg"
      >
        {isLoading ? (
          <PanelSkeleton />
        ) : error ? (
          <PanelError error={error} onRetry={refresh} />
        ) : artifact ? (
          <>
            <DialogHeader className="space-y-3">
              <DialogTitle className="pr-8 leading-snug">
                {artifact.title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ArtifactStatusBadge status={artifact.status} />
                    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                      <TagIcon className="mr-1 size-3" />
                      {titleCase(artifact.type)}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                      <FileTextIcon className="mr-1 size-3" />
                      {formatLabel(artifact.format)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground/60">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="size-3" />
                      {artifact.createdBy || "Unknown"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <CalendarIcon className="size-3" />
                      Created {formatRelativeTime(artifact.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <CalendarIcon className="size-3" />
                      Updated {formatRelativeTime(artifact.updatedAt)}
                    </span>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              {/* Summary */}
              {artifact.summary && (
                <div className="border-t border-border/40 pt-4">
                  <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Summary
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {artifact.summary}
                  </p>
                </div>
              )}

              {/* Content */}
              <div className="border-t border-border/40 pt-4">
                <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Content
                </h4>
                <pre className="whitespace-pre-wrap rounded-md bg-muted/30 p-3 font-mono text-sm leading-relaxed">
                  {artifact.content || "No content available"}
                </pre>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-6 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-2 h-px w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="mt-2 h-px w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function PanelError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
        <AlertCircleIcon className="size-6 text-destructive/50" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-sm font-medium text-foreground">Failed to load artifact</p>
        <p className="max-w-[240px] text-center text-xs leading-relaxed text-muted-foreground/60">
          {error}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
      >
        <RefreshCwIcon className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}
