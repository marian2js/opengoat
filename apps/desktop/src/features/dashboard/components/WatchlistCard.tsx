import { ArrowRightIcon, CircleAlertIcon, SparklesIcon } from "lucide-react";
import { watchlist } from "@/features/dashboard/data/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WatchlistCard() {
  return (
    <Card className="border border-border/70 bg-card/92 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.4)]">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Watchlist</CardTitle>
        <CardDescription>
          Names under review before they graduate into the core allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {watchlist.map((item) => {
          const positive = item.move.startsWith("+");

          return (
            <div
              key={item.symbol}
              className="rounded-2xl border border-border/70 bg-muted/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.symbol}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {item.name}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.thesis}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    positive
                      ? "rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                      : "rounded-full border-amber-500/20 bg-amber-500/10 text-amber-700"
                  }
                >
                  {item.move}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium">{item.price}</p>
                <Button variant="ghost" size="sm" className="rounded-full">
                  Review
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-dashed border-border/80 bg-background/80 p-4">
          <div className="flex items-center gap-2 font-medium">
            <SparklesIcon className="size-4 text-primary" />
            Idea queue
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A collapsible sidebar keeps watchlist review, account monitoring,
            and budgeting surfaces reachable without adding routing overhead too
            early.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <CircleAlertIcon className="size-3.5" />
            No live market data wired yet. These are architecture placeholders.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
