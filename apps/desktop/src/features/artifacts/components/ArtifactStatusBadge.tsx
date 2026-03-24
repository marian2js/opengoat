import { Badge } from "@/components/ui/badge";
import { getArtifactStatusConfig } from "@/features/artifacts/lib/artifact-status-config";

export function ArtifactStatusBadge({ status }: { status: string }) {
  const config = getArtifactStatusConfig(status);
  return (
    <Badge variant="outline" className={config.className}>
      <span className={`mr-1.5 inline-block size-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </Badge>
  );
}
