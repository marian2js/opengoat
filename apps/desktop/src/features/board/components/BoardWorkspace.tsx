import { ListChecksIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface BoardWorkspaceProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
}

export function BoardWorkspace({ agentId, client }: BoardWorkspaceProps) {
  if (!agentId || !client) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <ListChecksIcon className="size-8 text-muted-foreground/30" />
          <p className="text-sm">No project selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
            <ListChecksIcon className="size-6 text-muted-foreground/50" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">No tasks yet</h3>
            <p className="max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground/70">
              Tasks will appear here when created through actions or chat conversations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
