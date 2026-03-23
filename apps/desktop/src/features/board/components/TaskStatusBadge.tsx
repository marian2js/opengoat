import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/features/board/lib/status-config";

export function TaskStatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <Badge variant="outline" className={config.className}>
      <span className={`mr-1.5 inline-block size-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </Badge>
  );
}
