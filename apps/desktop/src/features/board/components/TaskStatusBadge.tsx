import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/features/board/lib/status-config";

export function TaskStatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
