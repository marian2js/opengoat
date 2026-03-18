import { CpuIcon, FolderTreeIcon, ShieldCheckIcon } from "lucide-react";
import type { AppMetadata } from "@/app/types";
import { allocationItems } from "@/features/dashboard/data/portfolio";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AllocationCardProps {
  metadata: AppMetadata;
}

export function AllocationCard({ metadata }: AllocationCardProps) {
  return (
    <Card className="border border-border/70 bg-card/92 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.4)]">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Allocation overview
        </CardTitle>
        <CardDescription>
          Current target mix and the app surface already wired into the desktop
          runtime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          {allocationItems.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.note}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{item.percentage}%</p>
                  <p className="text-xs text-muted-foreground">{item.amount}</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--chart-1),var(--chart-2))]"
                  style={{ width: item.percentage.toString() + "%" }}
                />
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-primary" />
              <p className="font-medium">Desktop runtime seams</p>
            </div>
            <Badge variant="outline" className="rounded-full px-2">
              {metadata.productName}
            </Badge>
          </div>
          <div className="grid gap-2">
            {metadata.workspaceLayout.map((item) => (
              <div
                key={item.path}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/35 px-3 py-2 text-sm"
              >
                <FolderTreeIcon className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {item.path}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.responsibility}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CpuIcon className="size-4 text-primary" />
              Architecture note
            </div>
            <p className="mt-1 leading-6">
              Shared UI now comes from shadcn primitives, while product-specific
              dashboard code stays in feature modules.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
