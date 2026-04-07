import { ArrowRightIcon, PackageIcon } from "lucide-react";
import type { RecommendedJob } from "@/features/dashboard/hooks/useRecommendedJobs";
import { buildActionPrompt } from "@/features/dashboard/data/prompt-builder";

export interface RecommendedJobCardProps {
  job: RecommendedJob;
  isHero?: boolean;
  onClick?: (actionId: string, prompt: string, label: string) => void;
}

export function RecommendedJobCard({ job, isHero, onClick }: RecommendedJobCardProps) {
  const { dotColor, iconBg, iconText } = job.specialistColors;
  const ctaText = job.ctaLabel ?? "Start";

  return (
    <button
      type="button"
      className={`group/job relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border bg-card text-left transition-all duration-100 ease-out ${
        isHero
          ? "border-primary/15 p-6 shadow-sm shadow-black/[0.03] hover:-translate-y-px hover:border-primary/25 hover:shadow-md dark:border-primary/10 dark:shadow-black/20"
          : "border-border/20 p-4 shadow-sm shadow-black/[0.02] hover:-translate-y-px hover:border-primary/25 hover:shadow-md dark:border-white/[0.06] dark:shadow-black/15"
      }`}
      onClick={() => onClick?.(job.id, buildActionPrompt(job), job.title)}
    >
      {/* Left accent bar for hero card */}
      {isHero && (
        <div className="absolute inset-y-0 left-0 w-[3px] bg-primary/40 transition-colors group-hover/job:bg-primary" />
      )}

      {/* Specialist attribution — colored chip with specialist identity */}
      {job.specialistName && (
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${iconBg} ${iconText}`}>
          <span className={`inline-block size-1.5 shrink-0 rounded-full ${dotColor}`} />
          {job.specialistName}
        </span>
      )}

      {/* Job title */}
      <h3
        className={`font-display leading-snug font-bold transition-colors group-hover/job:text-primary ${
          isHero ? "text-lg" : "text-[15px]"
        }`}
      >
        {job.title}
      </h3>

      {/* Output-type tag — scannable deliverable label */}
      {job.outputType && (
        <span className={`inline-flex items-center gap-1.5 rounded-md border font-mono uppercase tracking-wider ${
          isHero
            ? "border-primary/15 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold text-primary dark:border-primary/10 dark:bg-primary/[0.08]"
            : "border-border/30 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]"
        }`}>
          <PackageIcon className={isHero ? "size-3" : "size-2.5"} />
          {job.outputType}
        </span>
      )}

      {/* Promise — what the user gets / why it matters */}
      <p className={`leading-relaxed text-muted-foreground/70 ${isHero ? "text-[13px] line-clamp-3" : "text-xs line-clamp-2"}`}>
        {job.promise}
      </p>

      {/* Description — hero only, additional context */}
      {isHero && job.description && (
        <p className="text-xs leading-relaxed text-muted-foreground/50 line-clamp-2">
          {job.description}
        </p>
      )}

      {/* Outcome CTA */}
      <span className={`mt-auto inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors group-hover/job:text-primary ${
        isHero ? "text-primary/60" : "text-muted-foreground/40"
      }`}>
        {ctaText}
        <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/job:translate-x-0.5" />
      </span>
    </button>
  );
}
