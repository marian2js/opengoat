import type { MemoryRecord } from "@opengoat/contracts";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

function ConfidenceDots({ value }: { value: number }) {
  const level = value >= 0.8 ? 3 : value >= 0.5 ? 2 : 1;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${
                  i <= level ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Confidence: {Math.round(value * 100)}%
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export interface MemoryEntryCardProps {
  entry: MemoryRecord;
  onEdit: (entry: MemoryRecord) => void;
  onDelete: (memoryId: string) => void;
}

export function MemoryEntryCard({ entry, onEdit, onDelete }: MemoryEntryCardProps) {
  const isSuperseded = !!entry.replacedBy;

  return (
    <div
      className={`group rounded-lg border border-border/30 bg-elevated/50 p-3 transition-all duration-100 hover:-translate-y-0.5 hover:border-border/50 hover:shadow-sm hover:shadow-black/5 dark:hover:shadow-black/20 ${
        isSuperseded ? "opacity-50" : ""
      }`}
    >
      <div className={`text-[13px] leading-relaxed text-foreground/80 ${isSuperseded ? "line-through" : ""}`}>
        <p className="line-clamp-3">{entry.content}</p>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase tracking-wider"
          >
            {entry.source}
          </Badge>

          <ConfidenceDots value={entry.confidence} />

          {entry.userConfirmed ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              CONFIRMED
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
              UNCONFIRMED
            </span>
          )}

          {isSuperseded && (
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
              SUPERSEDED
            </Badge>
          )}

          {entry.supersedes && (
            <span className="text-[10px] text-muted-foreground/50">
              Updated from previous
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-2 font-mono text-[10px] text-muted-foreground/40">
            {formatRelativeTime(entry.updatedAt)}
          </span>

          {!isSuperseded && (
            <>
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              >
                <PencilIcon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.memoryId)}
                className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
