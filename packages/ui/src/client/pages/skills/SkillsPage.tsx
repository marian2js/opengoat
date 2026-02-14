import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, UsersRound } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import { AVAILABLE_SKILLS, COMING_SOON_SKILLS } from "./registry";

const INITIAL_VISIBLE_SKILL_CARD_COUNT = 6;

interface SkillsPageProps {
  liveAssignedSkillsCount: number;
  liveGlobalSkillsCount: number;
}

export function SkillsPage({
  liveAssignedSkillsCount,
  liveGlobalSkillsCount,
}: SkillsPageProps): ReactElement {
  const [visibleSkillCardCount, setVisibleSkillCardCount] = useState(() =>
    Math.min(INITIAL_VISIBLE_SKILL_CARD_COUNT, AVAILABLE_SKILLS.length),
  );

  const visibleSkillCards = useMemo(
    () => AVAILABLE_SKILLS.slice(0, visibleSkillCardCount),
    [visibleSkillCardCount],
  );
  const hasMoreSkillCards = visibleSkillCardCount < AVAILABLE_SKILLS.length;
  const totalVisibleSkillAssignments = useMemo(() => {
    return visibleSkillCards.reduce((sum, card) => sum + card.assignedCount, 0);
  }, [visibleSkillCards]);

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-card/80">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle>Skill Catalog</CardTitle>
              <Badge variant="secondary">Mock Data</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setVisibleSkillCardCount((current) =>
                    Math.min(current + 1, AVAILABLE_SKILLS.length),
                  );
                }}
                disabled={!hasMoreSkillCards}
              >
                <Plus className="size-4 icon-stroke-1_2" />
                Add Skill Card
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setVisibleSkillCardCount(
                    Math.min(
                      INITIAL_VISIBLE_SKILL_CARD_COUNT,
                      AVAILABLE_SKILLS.length,
                    ),
                  );
                }}
              >
                Reset
              </Button>
            </div>
          </div>
          <CardDescription>
            Visual card catalog for skills, each with image, concise description,
            and assignment count.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Showing
              </p>
              <p className="mt-1 text-xl font-semibold">
                {visibleSkillCards.length} / {AVAILABLE_SKILLS.length}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total Assignments
              </p>
              <p className="mt-1 text-xl font-semibold">
                {totalVisibleSkillAssignments}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Live Snapshot
              </p>
              <p className="mt-1 text-xl font-semibold">
                {liveAssignedSkillsCount} assigned · {liveGlobalSkillsCount} global
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleSkillCards.map((card) => (
          <article
            key={card.id}
            className="group overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
          >
            <div className="relative h-36 overflow-hidden">
              <img
                src={card.imageUrl}
                alt={`${card.name} skill card artwork`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <Badge className="absolute left-3 top-3 bg-background/90 text-foreground">
                {card.category}
              </Badge>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
                  {card.name}
                </h3>
                <Badge variant="secondary">{card.assignedCount}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground" title={card.description}>
                {card.description}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <UsersRound className="size-3.5 icon-stroke-1_2" />
                  {card.assignedCount} people assigned
                </span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                  View
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Card className="border-dashed border-border/70 bg-card/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Coming Soon</CardTitle>
            <Badge variant="secondary">{COMING_SOON_SKILLS.length} planned</Badge>
          </div>
          <CardDescription>
            Upcoming skills in the registry that are not available yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {COMING_SOON_SKILLS.map((skill) => (
              <article
                key={skill.id}
                className="overflow-hidden rounded-xl border border-dashed border-border/80 bg-background/20 opacity-90"
              >
                <div className="relative h-28 overflow-hidden">
                  <img
                    src={skill.imageUrl}
                    alt={`${skill.name} planned skill artwork`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <Badge className="absolute left-3 top-3 bg-amber-500/90 text-black">
                    Coming Soon
                  </Badge>
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold">{skill.name}</h3>
                    <Badge variant="secondary">{skill.category}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={skill.description}>
                    {skill.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
