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
      className={`group/job relative flex flex-col items-start gap-2.5 overflow-hidden rounded-xl border bg-card text-left transition-all duration-100 ease-out ${
        isHero
          ? "border-primary/15 p-5 hover:-translate-y-px hover:border-primary/25 hover:shadow-md dark:border-primary/10"
          : "border-border/20 p-4 hover:-translate-y-px hover:border-primary/25 hover:shadow-md dark:border-white/[0.06]"
      }`}
      onClick={() => onClick?.(job.id, buildActionPrompt(job), job.title)}
    >
      {/* Left accent bar for hero card */}
      {isHero && (
        <div className="absolute inset-y-0 left-0 w-[3px] bg-primary/40 transition-colors group-hover/job:bg-primary" />
      )}

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
          isHero ? "text-[16px]" : "text-sm"
        }`}
      >
        {job.title}
      </h3>

      {/* Promise — why this matters */}
      <p className={`leading-relaxed text-muted-foreground/70 line-clamp-2 ${isHero ? "text-[13px]" : "text-xs"}`}>
        {job.promise}
      </p>

      {/* CTA */}
      <span className={`mt-auto inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors group-hover/job:text-primary ${
        isHero ? "text-primary/50" : "text-muted-foreground/40"
      }`}>
        Start
        <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/job:translate-x-0.5" />
      </span>
    </button>
  );
}
