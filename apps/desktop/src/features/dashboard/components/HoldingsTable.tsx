import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { holdings } from "@/features/dashboard/data/portfolio";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function HoldingsTable() {
  return (
    <Card className="border border-border/70 bg-card/92 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.4)]">
      <CardHeader id="accounts">
        <CardTitle className="text-xl font-semibold">Top holdings</CardTitle>
        <CardDescription>
          A quick read of concentration, daily move, and current market value.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <Table>
            <TableHeader className="bg-muted/45">
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead className="text-right">Market value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding) => {
                const isPositive = holding.dayChange.startsWith("+");

                return (
                  <TableRow key={holding.symbol}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{holding.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {holding.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{holding.shares}</TableCell>
                    <TableCell>{holding.price}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isPositive
                            ? "rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                            : "rounded-full border-amber-500/20 bg-amber-500/10 text-amber-700"
                        }
                      >
                        {isPositive ? (
                          <ArrowUpRightIcon className="size-3.5" />
                        ) : (
                          <ArrowDownRightIcon className="size-3.5" />
                        )}
                        {holding.dayChange}
                      </Badge>
                    </TableCell>
                    <TableCell>{holding.allocation}</TableCell>
                    <TableCell className="text-right font-medium">
                      {holding.marketValue}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
