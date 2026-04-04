import { CheckCircleIcon, CircleDotIcon, CircleIcon, ListChecksIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { SidecarClient, PlaybookProgressResponse, PhaseProgressDetail } from "@/lib/sidecar/client";

interface RunContextBannerProps {
  runId: string;
  client: SidecarClient;
}

/**
 * Compact banner showing playbook phase context in the specialist chat.
 * Displays: playbook title, phase stepper, and expected deliverables for current phase.
 * Auto-refreshes every 30s to detect phase advancement.
 */
export function RunContextBanner({ runId, client }: RunContextBannerProps) {
  const [progress, setProgress] = useState<PlaybookProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await client.getRunProgress(runId);
        if (!cancelled) setProgress(data);
      } catch {
        // Non-critical — banner is informational
      }
      if (!cancelled) setIsLoading(false);
    }

    void load();

    // Auto-refresh every 30s
    const interval = setInterval(() => { void load(); }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runId, client]);

  if (isLoading || !progress) return null;

  const currentPhase = progress.phases.find((p) => p.status === "current");
  const deliverables = currentPhase?.expectedArtifacts ?? [];

  return (
    <div className="border-b border-primary/10 bg-primary/[0.03] px-4 py-2 lg:px-6">
      <div className="flex items-center gap-2.5">
        <ListChecksIcon className="size-3.5 shrink-0 text-primary/60" />
        <span className="text-[11px] font-semibold text-foreground/80">
          {progress.playbookTitle}
        </span>
        <span className="text-[10px] text-muted-foreground/40">|</span>
        <PhaseStepper phases={progress.phases} />
      </div>
      {deliverables.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Deliverables:
          </span>
          {deliverables.map((d) => (
            <span
              key={d}
              className="rounded-md border border-border/30 bg-card/60 px-1.5 py-px text-[10px] text-muted-foreground/70"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseStepper({ phases }: { phases: PhaseProgressDetail[] }) {
  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, i) => (
        <div key={phase.name} className="flex items-center gap-1">
          {i > 0 && (
            <span className={`h-px w-2.5 ${phase.status === "upcoming" ? "bg-border/40" : "bg-primary/30"}`} />
          )}
          <span
            className={`inline-flex items-center gap-1 rounded px-1 py-px text-[10px] font-medium ${
              phase.status === "completed"
                ? "text-primary/70"
                : phase.status === "current"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground/40"
            }`}
            title={phase.description}
          >
            {phase.status === "completed" ? (
              <CheckCircleIcon className="size-2.5" />
            ) : phase.status === "current" ? (
              <CircleDotIcon className="size-2.5" />
            ) : (
              <CircleIcon className="size-2.5" />
            )}
            {phase.name}
          </span>
        </div>
      ))}
    </div>
  );
}
