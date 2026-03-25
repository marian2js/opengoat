import {
  PlayCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CircleDotIcon,
  SaveIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { useActionSessions } from "@/features/dashboard/hooks/useActionSessions";
import type { ActionSessionEntry } from "@/features/dashboard/hooks/useActionSessions";

export interface ActiveWorkSectionProps {
  onContinueSession?: (sessionId: string) => void;
}

const stateConfig: Record<
  string,
  { label: string; className: string; icon: typeof PlayCircleIcon }
> = {
  starting: {
    label: "Starting",
    className: "bg-primary/10 text-primary",
    icon: CircleDotIcon,
  },
  working: {
    label: "Working",
    className: "bg-primary/10 text-primary",
    icon: PlayCircleIcon,
  },
  "needs-input": {
    label: "Needs input",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: AlertCircleIcon,
  },
  "ready-to-review": {
    label: "Ready to review",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: EyeIcon,
  },
  "saved-to-board": {
    label: "Saved to board",
    className: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
    icon: SaveIcon,
  },
  done: {
    label: "Done",
    className: "bg-success/10 text-success dark:bg-green-900/20 dark:text-green-400",
    icon: CheckCircle2Icon,
  },
};

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function SessionCard({
  session,
  onContinue,
  variant,
}: {
  session: ActionSessionEntry;
  onContinue?: (sessionId: string) => void;
  variant: "active" | "recent";
}) {
  const config = stateConfig[session.state] ?? stateConfig.working!;
  const StateIcon = config.icon;

  if (variant === "recent") {
    return (
      <div className="rounded-md border border-border/30 px-3 py-2 transition-colors hover:border-border/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <StateIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className="truncate text-sm text-foreground">
              {session.actionTitle}
            </span>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${config.className}`}
            >
              {config.label}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/50">
            {formatTimeAgo(session.startedAt)}
          </span>
        </div>

        {/* Output preview */}
        {session.latestOutput && (
          <p className="mt-1.5 line-clamp-2 pl-6 text-xs leading-relaxed text-muted-foreground">
            {session.latestOutput}
          </p>
        )}

        {/* Quick actions */}
        <div className="mt-2 flex items-center gap-2 pl-6">
          {onContinue && (
            <button
              type="button"
              onClick={() => onContinue(session.sessionId)}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Continue
              <ArrowRightIcon className="size-3" />
            </button>
          )}
          {onContinue && (
            <button
              type="button"
              onClick={() => onContinue(session.sessionId)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              Review
              <EyeIcon className="size-3" />
            </button>
          )}
          <a
            href="#board"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            Open Board
            <LayoutDashboardIcon className="size-3" />
          </a>
        </div>
      </div>
    );
  }

  // Active variant — more prominent card
  return (
    <div className="rounded-lg border bg-card/90 p-4">
      <div className="mb-2 flex items-center gap-2">
        <StateIcon className="size-3.5 text-primary" />
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${config.className}`}
        >
          {config.label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
          {formatTimeAgo(session.startedAt)}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-medium text-foreground">
        {session.actionTitle}
      </h3>

      {/* Output preview */}
      {session.latestOutput && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {session.latestOutput}
        </p>
      )}

      {/* Pending question indicator */}
      {session.state === "needs-input" && (
        <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Waiting for your input to continue
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        {onContinue && (
          <button
            type="button"
            onClick={() => onContinue(session.sessionId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continue
            <ArrowRightIcon className="size-3" />
          </button>
        )}
        {onContinue && (
          <button
            type="button"
            onClick={() => onContinue(session.sessionId)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <EyeIcon className="size-3" />
            Review
          </button>
        )}
        <a
          href="#board"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <LayoutDashboardIcon className="size-3" />
          Open Board
        </a>
      </div>
    </div>
  );
}

export function ActiveWorkSection({ onContinueSession }: ActiveWorkSectionProps) {
  const { activeSessions, recentSessions, hasActiveWork } = useActionSessions();

  if (!hasActiveWork) {
    return null;
  }

  return (
    <div className="mb-5 space-y-4">
      {/* Now working on — active sessions */}
      {activeSessions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
              <PlayCircleIcon className="size-3.5 text-primary" />
            </div>
            <h2 className="section-label">Now working on</h2>
          </div>
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                onContinue={onContinueSession}
                variant="active"
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent work — completed sessions */}
      {recentSessions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
              <ClockIcon className="size-3.5 text-primary" />
            </div>
            <h2 className="section-label">Recent work</h2>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              {recentSessions.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {recentSessions.slice(0, 5).map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                onContinue={onContinueSession}
                variant="recent"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
