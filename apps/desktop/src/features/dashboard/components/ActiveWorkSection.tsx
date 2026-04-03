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
  onViewResults?: (actionId: string) => void;
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
  onViewResults,
  variant,
}: {
  session: ActionSessionEntry;
  onContinue?: (sessionId: string) => void;
  onViewResults?: (actionId: string) => void;
  variant: "active" | "recent";
}) {
  const config = stateConfig[session.state] ?? stateConfig.working!;
  const StateIcon = config.icon;

  if (variant === "recent") {
    const handleClick = () => {
      if (onContinue) onContinue(session.sessionId);
      else if (onViewResults) onViewResults(session.actionId);
    };

    return (
      <button
        type="button"
        onClick={handleClick}
        className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border/20 px-3.5 py-2.5 text-left transition-colors hover:border-border/40 hover:bg-white/[0.02]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <StateIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
          <span className="truncate text-sm text-foreground">
            {session.actionTitle}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${config.className}`}
          >
            {config.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {formatTimeAgo(session.startedAt)}
          </span>
          <ArrowRightIcon className="size-3 text-muted-foreground/30 transition-colors group-hover:text-primary" />
        </div>
      </button>
    );
  }

  // Active variant — more prominent card
  return (
    <div className="rounded-xl border border-border/20 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <StateIcon className="size-3.5 text-primary" />
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${config.className}`}
        >
          {config.label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
          {formatTimeAgo(session.startedAt)}
        </span>
      </div>

      <h3 className="mb-1.5 text-sm font-semibold text-foreground">
        {session.actionTitle}
      </h3>

      {/* Output preview */}
      {session.latestOutput && (
        <p className="mb-3.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {session.latestOutput}
        </p>
      )}

      {/* Pending question indicator */}
      {session.state === "needs-input" && (
        <div className="mb-3.5 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3.5 py-2.5">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Waiting for your input to continue
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-2">
        {onContinue && (
          <button
            type="button"
            onClick={() => onContinue(session.sessionId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Continue
            <ArrowRightIcon className="size-3" />
          </button>
        )}
        {onViewResults && (
          <button
            type="button"
            onClick={() => onViewResults(session.actionId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Review
          </button>
        )}
        <a
          href="#board"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutDashboardIcon className="size-3" />
          Open Board
        </a>
      </div>
    </div>
  );
}

export function ActiveWorkSection({ onContinueSession, onViewResults }: ActiveWorkSectionProps) {
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
                onViewResults={onViewResults}
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
                onViewResults={onViewResults}
                variant="recent"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
