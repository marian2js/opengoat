import { ArrowRightIcon } from "lucide-react";
import type { RecommendedJob } from "@/features/dashboard/hooks/useRecommendedJobs";
import { buildActionPrompt } from "@/features/dashboard/data/prompt-builder";

export interface RecommendedJobCardProps {
  job: RecommendedJob;
  isHero?: boolean;
  onClick?: (actionId: string, prompt: string, label: string) => void;
}

export function RecommendedJobCard({ job, isHero, onClick }: RecommendedJobCardProps) {
  const { dotColor } = job.specialistColors;

  return (
    <button
      type="button"
      className={`group/job flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all duration-100 ease-out ${
        isHero
          ? "border-border/30 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-black/5 dark:border-white/[0.08] dark:hover:shadow-black/20"
          : "border-border/20 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md hover:shadow-black/5 dark:border-white/[0.06] dark:hover:shadow-black/20"
      }`}
      onClick={() => onClick?.(job.id, buildActionPrompt(job), job.title)}
    >
      {/* Specialist attribution */}
      {job.specialistName && (
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          <span className={`inline-block size-1.5 shrink-0 rounded-full ${dotColor}`} />
          {job.specialistName}
        </span>
      )}

      {/* Job title */}
      <h3
        className={`font-display leading-snug font-bold transition-colors group-hover/job:text-primary ${
          isHero ? "text-[15px]" : "text-sm"
        }`}
      >
        {job.title}
      </h3>

      {/* Promise — why this matters */}
      <p className={`leading-relaxed text-muted-foreground/70 line-clamp-2 ${isHero ? "text-[13px]" : "text-xs"}`}>
        {job.promise}
      </p>

      {/* CTA */}
      <span className="mt-auto inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 transition-colors group-hover/job:text-primary">
        Start
        <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/job:translate-x-0.5" />
      </span>
    </button>
  );
}
