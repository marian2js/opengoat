import type { TaskEntry } from "@opengoat/contracts";
import { ShieldAlertIcon, FileTextIcon, ClockIcon } from "lucide-react";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

// ---------------------------------------------------------------------------
// Shared section wrapper
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
      {children}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

export function TaskBlockersSection({ blockers }: { blockers: string[] }) {
  return (
    <div className="border-t border-border/40 pt-4">
      <SectionHeading>Blockers</SectionHeading>
      {blockers.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">No blockers</p>
      ) : (
        <ul className="space-y-2">
          {blockers.map((blocker, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0 text-red-500" />
              <span>{blocker}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export function TaskArtifactsSection({
  artifacts,
}: {
  artifacts: TaskEntry[];
}) {
  return (
    <div className="border-t border-border/40 pt-4">
      <SectionHeading>Artifacts</SectionHeading>
      {artifacts.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">No artifacts</p>
      ) : (
        <ul className="space-y-2">
          {artifacts.map((entry, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="break-words">{entry.content}</p>
                <p className="text-xs text-muted-foreground/60">
                  {formatRelativeTime(entry.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Worklog
// ---------------------------------------------------------------------------

export function TaskWorklogSection({ worklog }: { worklog: TaskEntry[] }) {
  return (
    <div className="border-t border-border/40 pt-4">
      <SectionHeading>Worklog</SectionHeading>
      {worklog.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">No worklog entries</p>
      ) : (
        <ul className="space-y-2">
          {worklog.map((entry, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="break-words">{entry.content}</p>
                <p className="text-xs text-muted-foreground/60">
                  {formatRelativeTime(entry.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
