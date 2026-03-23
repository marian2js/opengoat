import type { SidecarClient } from "@/lib/sidecar/client";
import { SignalFeed } from "./SignalFeed";

export interface SignalsTabProps {
  objectiveId: string;
  client: SidecarClient;
}

export function SignalsTab({ objectiveId, client }: SignalsTabProps) {
  return (
    <SignalFeed
      client={client}
      filters={{ objectiveId }}
      showFilters={true}
      emptyMessage="No signals linked to this objective — signals will surface relevant opportunities as they are detected"
    />
  );
}
