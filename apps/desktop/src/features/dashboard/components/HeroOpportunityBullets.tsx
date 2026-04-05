import type { Opportunity } from "@/features/dashboard/data/opportunities";
import { opportunityCategoryConfig } from "@/features/dashboard/data/opportunities";
import { AlertTriangleIcon } from "lucide-react";

export interface HeroOpportunityBulletsProps {
  opportunities: Opportunity[];
  mainRisk: string | null;
  topOpportunity: string | null;
}

const MAX_BULLETS = 4;

export function HeroOpportunityBullets({
  opportunities,
  mainRisk,
}: HeroOpportunityBulletsProps) {
  // Build bullet list: up to 3 opportunities + mainRisk if distinct
  const bullets: { key: string; color: string; text: string; isRisk?: boolean }[] = [];

  for (const opp of opportunities.slice(0, 3)) {
    const config = opportunityCategoryConfig[opp.category];
    bullets.push({
      key: opp.id,
      color: config.accentColor,
      text: opp.title,
    });
  }

  // Add mainRisk as a risk bullet if available and distinct from existing bullets
  if (
    mainRisk &&
    bullets.length < MAX_BULLETS &&
    !bullets.some((b) => b.text.toLowerCase().includes("risk"))
  ) {
    bullets.push({
      key: "main-risk",
      color: "bg-amber-500",
      text: mainRisk.length > 80 ? mainRisk.slice(0, 77) + "..." : mainRisk,
      isRisk: true,
    });
  }

  if (bullets.length === 0) return null;

  return (
    <div>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
        WHAT MATTERS NOW
      </span>
      <ul className="mt-2 space-y-1.5">
        {bullets.map((bullet) => (
          <li key={bullet.key} className="flex items-start gap-2.5">
            {bullet.isRisk ? (
              <AlertTriangleIcon className="mt-[3px] size-3 shrink-0 text-amber-500" />
            ) : (
              <span
                className={`mt-[7px] block size-1.5 shrink-0 rounded-full ${bullet.color}`}
              />
            )}
            <span className="text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
              {bullet.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
