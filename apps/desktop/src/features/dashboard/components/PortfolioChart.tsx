"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  portfolioHistory,
  type PortfolioHistoryPoint,
} from "@/features/dashboard/data/portfolio";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type RangeKey = keyof typeof portfolioHistory;

const chartConfig = {
  portfolio: {
    label: "Net worth",
    color: "var(--chart-1)",
  },
  invested: {
    label: "Invested assets",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function formatXAxisLabel(value: string, range: RangeKey) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    ...(range === "1m" ? { day: "numeric" } : {}),
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IE", {
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
  }).format(value);
}

export function PortfolioChart() {
  const [range, setRange] = useState<RangeKey>("3m");

  const data = useMemo<PortfolioHistoryPoint[]>(
    () => portfolioHistory[range],
    [range],
  );

  return (
    <Card
      id="portfolio"
      className="border border-border/70 bg-card/92 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.4)]"
    >
      <CardHeader className="gap-4 border-b border-border/70">
        <div>
          <CardTitle className="text-xl font-semibold">
            Portfolio trajectory
          </CardTitle>
          <CardDescription>
            Net worth against invested capital for the current household.
          </CardDescription>
        </div>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(nextValue) => {
            if (nextValue) {
              setRange(nextValue as RangeKey);
            }
          }}
          variant="outline"
          className="justify-start"
        >
          <ToggleGroupItem value="1m">1M</ToggleGroupItem>
          <ToggleGroupItem value="3m">3M</ToggleGroupItem>
          <ToggleGroupItem value="ytd">YTD</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6">
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <AreaChart data={data} margin={{ left: 12, right: 12, top: 10 }}>
            <defs>
              <linearGradient id="fillPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-portfolio)"
                  stopOpacity={0.28}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-portfolio)"
                  stopOpacity={0.02}
                />
              </linearGradient>
              <linearGradient id="fillInvested" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-invested)"
                  stopOpacity={0.18}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-invested)"
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              axisLine={false}
              dataKey="date"
              minTickGap={28}
              tickLine={false}
              tickMargin={12}
              tickFormatter={(value) => formatXAxisLabel(String(value), range)}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatCurrency(Number(value))}
              width={76}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(label) =>
                    new Intl.DateTimeFormat("en", {
                      month: "long",
                      day: "numeric",
                    }).format(new Date(String(label)))
                  }
                  formatter={(value, name) => (
                    <div className="flex min-w-[10rem] items-center justify-between gap-6">
                      <span className="text-muted-foreground">
                        {String(name)}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
              cursor={false}
            />
            <Area
              dataKey="invested"
              fill="url(#fillInvested)"
              fillOpacity={1}
              stroke="var(--color-invested)"
              strokeWidth={2}
              type="monotone"
            />
            <Area
              dataKey="portfolio"
              fill="url(#fillPortfolio)"
              fillOpacity={1}
              stroke="var(--color-portfolio)"
              strokeWidth={2.5}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
