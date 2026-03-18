"use client";

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  PiggyBankIcon,
  ShieldCheckIcon,
  WalletCardsIcon,
  WavesIcon,
} from "lucide-react";
import { dashboardMetrics } from "@/features/dashboard/data/portfolio";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const metricIcons = [
  WalletCardsIcon,
  ArrowUpRightIcon,
  WavesIcon,
  PiggyBankIcon,
];

export function MetricCards() {
  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {dashboardMetrics.map((metric, index) => {
        const Icon = metricIcons[index] ?? WalletCardsIcon;
        const TrendIcon =
          metric.trend === "up" ? ArrowUpRightIcon : ArrowDownRightIcon;
        const trendClassName =
          metric.trend === "up"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
            : "border-amber-500/20 bg-amber-500/10 text-amber-700";

        return (
          <Card
            key={metric.label}
            className="border border-border/70 bg-card/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]"
          >
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {metric.value}
              </CardTitle>
              <CardAction>
                <div className="rounded-2xl bg-primary/8 p-2 text-primary">
                  <Icon className="size-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardFooter className="items-center justify-between gap-3 border-t border-border/70 bg-muted/35">
              <Badge variant="outline" className={trendClassName}>
                <TrendIcon className="size-3.5" />
                {metric.delta}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-3.5" />
                {metric.context}
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </section>
  );
}
