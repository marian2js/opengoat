import type { TaskEntry } from "@opengoat/contracts";
import { ShieldAlertIcon, FileTextIcon, ClockIcon } from "lucide-react";
import { formatRelativeTime } from "@/features/board/lib/format-relative-time";

// ---------------------------------------------------------------------------
// Shared section wrapper
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
      {children}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// Blockers — visually prominent because they block work
// ---------------------------------------------------------------------------

export function TaskBlockersSection({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) return null;

  return (
    <div className="border-t border-border/40 py-3">
      <SectionHeading>Blockers</SectionHeading>
      <div className="mt-1.5 rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2">
        <ul className="space-y-1.5">
          {blockers.map((blocker, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0 text-red-400" />
              <span className="text-foreground/90">{blocker}</span>
            </li>
          ))}
        </ul>
      </div>
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
  if (artifacts.length === 0) return null;

  return (
    <div className="border-t border-border/40 py-3">
      <SectionHeading>Artifacts</SectionHeading>
      <ul className="space-y-1">
        {artifacts.map((entry, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px]">
            <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0 flex-1">
              <span className="text-foreground/80">{entry.content}</span>
              <span className="ml-2 text-[11px] text-muted-foreground/40">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Worklog
// ---------------------------------------------------------------------------

export function TaskWorklogSection({ worklog }: { worklog: TaskEntry[] }) {
  if (worklog.length === 0) return null;

  return (
    <div className="border-t border-border/40 py-3">
      <SectionHeading>Activity</SectionHeading>
      <ul className="space-y-1">
        {worklog.map((entry, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px]">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0 flex-1">
              <span className="text-foreground/80">{entry.content}</span>
              <span className="ml-2 text-[11px] text-muted-foreground/40">
                {formatRelativeTime(entry.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
