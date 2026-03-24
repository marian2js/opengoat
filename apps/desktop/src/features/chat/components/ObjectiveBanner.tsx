import {
  ArrowUpRightIcon,
  FileTextIcon,
  LayoutGridIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import type { ChatScope } from "@/features/chat/lib/chat-scope";
import type { Objective } from "@/features/dashboard/types/objective";
import type { SidecarClient } from "@/lib/sidecar/client";
import { useObjectiveDetail } from "@/features/objectives/hooks/useObjectiveDetail";
import { ObjectivePicker } from "./ObjectivePicker";

interface ObjectiveBannerProps {
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;
  client: SidecarClient;
  agentId: string;
  runTitle?: string;
}

function StatusDot({ status }: { status: Objective["status"] }) {
  const colors: Record<Objective["status"], string> = {
    draft: "bg-muted-foreground/40",
    active: "bg-emerald-500",
    paused: "bg-amber-500",
    completed: "bg-primary",
    abandoned: "bg-muted-foreground/30",
  };
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full ${colors[status] ?? "bg-muted-foreground/40"}`}
      title={status}
    />
  );
}

export function ObjectiveBanner({
  scope,
  setScope,
  client,
  agentId,
  runTitle,
}: ObjectiveBannerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const objectiveId =
    scope.type === "objective"
      ? scope.objectiveId
      : scope.type === "run"
        ? scope.objectiveId
        : undefined;

  const { objective, isLoading, error } = useObjectiveDetail(
    objectiveId ?? "",
    client,
  );

  // Only render when we have an objective or run scope
  if (scope.type !== "objective" && scope.type !== "run") {
    return null;
  }

  // Show error state if objective couldn't be loaded
  if (!isLoading && (error || !objective)) {
    return (
      <div className="flex items-center gap-2 border-b border-destructive/15 bg-destructive/4 px-4 py-1.5 lg:px-6">
        <span className="text-[11px] text-destructive/70">
          Scope invalid — objective not found
        </span>
        <button
          type="button"
          className="text-[11px] font-medium text-destructive/80 underline underline-offset-2 hover:text-destructive"
          onClick={() => setScope({ type: "unattached" })}
        >
          Clear scope
        </button>
      </div>
    );
  }

  if (isLoading || !objective) {
    return (
      <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/4 px-4 py-1.5 lg:px-6">
        <span className="text-[11px] text-muted-foreground/60">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-primary/10 bg-primary/4 px-4 py-1.5 lg:px-6">
      {/* Objective info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <StatusDot status={objective.status} />
        <span
          className="truncate text-[11px] font-medium text-foreground/80"
          title={objective.title}
        >
          {objective.title}
        </span>
        {scope.type === "run" && runTitle ? (
          <>
            <span className="text-[10px] text-muted-foreground/40">/</span>
            <span
              className="truncate text-[10px] text-muted-foreground/70"
              title={runTitle}
            >
              {runTitle}
            </span>
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <div className="flex shrink-0 items-center gap-1">
        <BannerAction
          icon={RefreshCwIcon}
          label="Change Objective"
          onClick={() => setPickerOpen(true)}
        />
        <BannerAction
          icon={PlayIcon}
          label="Create Run"
          onClick={() => {
            window.location.hash = `#objective/${objectiveId}/runs`;
          }}
        />
        <BannerAction
          icon={LayoutGridIcon}
          label="Open Board"
          onClick={() => {
            window.location.hash = `#board?objective=${objectiveId}`;
          }}
        />
        <BannerAction
          icon={FileTextIcon}
          label="Open Artifacts"
          onClick={() => {
            window.location.hash = `#objective/${objectiveId}/artifacts`;
          }}
        />
      </div>

      {pickerOpen ? (
        <ObjectivePicker
          agentId={agentId}
          client={client}
          currentObjectiveId={objectiveId}
          onSelect={(selectedId) => {
            setScope({ type: "objective", objectiveId: selectedId });
            setPickerOpen(false);
          }}
          onClear={() => {
            setScope({ type: "unattached" });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function BannerAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowUpRightIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 transition-colors hover:bg-primary/8 hover:text-primary"
      onClick={onClick}
      title={label}
    >
      <Icon className="size-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
