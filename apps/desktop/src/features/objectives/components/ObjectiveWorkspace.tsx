import { ArrowLeftIcon, TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useObjectiveDetail } from "@/features/objectives/hooks/useObjectiveDetail";
import { ObjectiveStatusBadge } from "./ObjectiveStatusBadge";
import { ObjectiveQuickActions } from "./ObjectiveQuickActions";
import { ObjectiveTabNav } from "./ObjectiveTabNav";
import type { ObjectiveTabValue } from "./ObjectiveTabNav";

export interface ObjectiveWorkspaceProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
  objectiveId?: string | undefined;
  objectiveTab?: string | undefined;
  onResumeRun?: (sessionId: string) => void;
}

export function ObjectiveWorkspace({
  agentId,
  client,
  objectiveId,
  objectiveTab,
  onResumeRun,
}: ObjectiveWorkspaceProps) {
  if (!agentId || !client || !objectiveId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <TargetIcon className="size-8 text-muted-foreground/30" />
          <p className="text-sm">No objective selected</p>
        </div>
      </div>
    );
  }

  return (
    <ObjectiveWorkspaceContent
      agentId={agentId}
      client={client}
      objectiveId={objectiveId}
      objectiveTab={objectiveTab}
      onResumeRun={onResumeRun}
    />
  );
}

function ObjectiveWorkspaceContent({
  agentId,
  client,
  objectiveId,
  objectiveTab,
  onResumeRun,
}: {
  agentId: string;
  client: SidecarClient;
  objectiveId: string;
  objectiveTab?: string;
  onResumeRun?: (sessionId: string) => void;
}) {
  const { objective, isLoading, error, refresh } = useObjectiveDetail(
    objectiveId,
    client,
  );

  const activeTab = (objectiveTab ?? "overview") as ObjectiveTabValue;

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 gap-1.5 text-xs text-muted-foreground"
          onClick={() => {
            window.location.hash = "";
          }}
        >
          <ArrowLeftIcon className="size-3" />
          Dashboard
        </Button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-full max-w-lg" />
          </div>
        ) : objective ? (
          <div className="space-y-3">
            {/* Status + goal type */}
            <div className="flex items-center gap-2">
              <ObjectiveStatusBadge status={objective.status} />
              {objective.goalType ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {objective.goalType}
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {objective.title}
            </h1>

            {/* Quick actions */}
            <ObjectiveQuickActions
              objective={objective}
              client={client}
              onStatusChanged={refresh}
            />
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <ObjectiveTabNav
        objective={objective}
        objectiveId={objectiveId}
        agentId={agentId}
        client={client}
        activeTab={activeTab}
        isLoading={isLoading}
        onResumeRun={onResumeRun}
      />
    </div>
  );
}
