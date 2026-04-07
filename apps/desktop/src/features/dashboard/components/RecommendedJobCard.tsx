import { ArrowRightIcon, PackageIcon } from "lucide-react";
import type { RecommendedJob } from "@/features/dashboard/hooks/useRecommendedJobs";
import { buildActionPrompt } from "@/features/dashboard/data/prompt-builder";

export interface RecommendedJobCardProps {
  job: RecommendedJob;
  tier: "hero" | "primary" | "secondary";
  onClick?: (actionId: string, prompt: string, label: string) => void;
}

export function RecommendedJobCard({ job, tier, onClick }: RecommendedJobCardProps) {
  const { dotColor, iconBg, iconText } = job.specialistColors;
  const ctaText = job.ctaLabel ?? "Start";

  const isHero = tier === "hero";
  const isPrimary = tier === "primary";
  const isSecondary = tier === "secondary";

  // ── Tier-driven style tokens ──
  const containerClasses = isHero
    ? "gap-3 border-primary/15 p-6 shadow-sm shadow-black/[0.03] hover:-translate-y-px hover:border-primary/30 hover:shadow-lg dark:border-primary/10 dark:bg-gradient-to-br dark:from-[#18181B] dark:to-primary/[0.03] dark:shadow-black/20"
    : isPrimary
      ? "gap-2.5 border-primary/10 p-4 shadow-sm shadow-black/[0.02] hover:-translate-y-px hover:border-primary/25 hover:shadow-md dark:border-primary/8 dark:shadow-black/15"
      : "gap-2 border-border/15 p-3 shadow-sm shadow-black/[0.01] hover:-translate-y-px hover:border-border/30 hover:shadow-sm dark:border-white/[0.03] dark:shadow-black/10";

  const titleSize = isHero ? "text-lg" : isPrimary ? "text-[15px]" : "text-sm";

  const promiseClasses = isHero
    ? "text-[13px] line-clamp-3"
    : isPrimary
      ? "text-xs line-clamp-2"
      : "text-xs line-clamp-1";

  const ctaClasses = isHero
    ? "text-primary/70"
    : isPrimary
      ? "text-muted-foreground/60"
      : "text-muted-foreground/30";

  return (
    <button
      type="button"
      className={`group/job relative flex flex-col items-start overflow-hidden rounded-xl border bg-card text-left transition-all duration-100 ease-out ${containerClasses}`}
      onClick={() => onClick?.(job.id, buildActionPrompt(job), job.title)}
    >
      {/* Left accent bar for hero card */}
      {isHero && (
        <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-primary/50 transition-colors group-hover/job:bg-primary" />
      )}

      {/* Top row: specialist chip + output type */}
      <div className="flex items-center gap-2">
        {/* Specialist attribution */}
        {job.specialistName && (
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${iconBg} ${iconText}`}>
            <span className={`inline-block size-1.5 shrink-0 rounded-full ${dotColor}`} />
            {job.specialistName}
          </span>
        )}

        {/* Output-type tag — inline for primary/secondary */}
        {job.outputType && !isHero && (
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${
            isPrimary
              ? "border-primary/10 bg-primary/[0.04] text-muted-foreground/60 dark:border-primary/8 dark:bg-primary/[0.03]"
              : "border-border/20 bg-muted/30 text-muted-foreground/40 dark:border-white/[0.04] dark:bg-white/[0.02]"
          }`}>
            <PackageIcon className="size-2.5" />
            {job.outputType}
          </span>
        )}
      </div>

      {/* Job title */}
      <h3
        className={`font-display leading-snug font-bold transition-colors group-hover/job:text-primary ${titleSize}`}
      >
        {job.title}
      </h3>

      {/* Output-type tag — hero only, larger treatment */}
      {job.outputType && isHero && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.06] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary dark:border-primary/10 dark:bg-primary/[0.08]">
          <PackageIcon className="size-3" />
          {job.outputType}
        </span>
      )}

      {/* Promise — what the user gets / why it matters */}
      <p className={`leading-relaxed text-muted-foreground/70 ${promiseClasses}`}>
        {job.promise}
      </p>

      {/* Description — hero only, additional context */}
      {isHero && job.description && (
        <p className="text-xs leading-relaxed text-muted-foreground/50 line-clamp-2">
          {job.description}
        </p>
      )}

      {/* Outcome CTA */}
      <span className={`mt-auto inline-flex items-center gap-1.5 pt-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors group-hover/job:text-primary ${ctaClasses}`}>
        {ctaText}
        <ArrowRightIcon className="size-3 transition-transform duration-150 group-hover/job:translate-x-0.5" />
      </span>
    </button>
  );
}
