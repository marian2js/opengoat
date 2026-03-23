import { ActivityIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useSinceYouWereAway } from "@/features/dashboard/hooks/useSinceYouWereAway";
import { FeedItemCard } from "@/features/dashboard/components/FeedItem";

export interface SinceYouWereAwaySectionProps {
  client: SidecarClient;
  agentId: string;
  projectId: string;
}

function FeedSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-3.5 rounded" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/60 px-5 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="ml-6 h-3 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SinceYouWereAwaySection({
  client,
  agentId,
  projectId,
}: SinceYouWereAwaySectionProps) {
  const { items, isLoading, isEmpty } = useSinceYouWereAway(
    client,
    agentId,
    projectId,
  );

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (isEmpty) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ActivityIcon className="size-3.5 text-primary" />
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          SINCE YOU WERE AWAY
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <FeedItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
