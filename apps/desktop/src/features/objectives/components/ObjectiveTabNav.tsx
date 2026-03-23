import { useCallback } from "react";
import {
  FileTextIcon,
  PlayCircleIcon,
  PackageIcon,
  ClipboardListIcon,
  RadioIcon,
  BrainIcon,
  ActivityIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Objective } from "@/features/dashboard/types/objective";
import { OverviewTab } from "./OverviewTab";
import { RunsTab } from "./RunsTab";
import { ArtifactsTab } from "./ArtifactsTab";
import { TasksTab } from "./TasksTab";
import { PlaceholderTab } from "./PlaceholderTab";

const TABS = [
  { value: "overview", label: "Overview", icon: FileTextIcon },
  { value: "runs", label: "Runs", icon: PlayCircleIcon },
  { value: "artifacts", label: "Artifacts", icon: PackageIcon },
  { value: "tasks", label: "Tasks", icon: ClipboardListIcon },
  { value: "signals", label: "Signals", icon: RadioIcon },
  { value: "memory", label: "Memory", icon: BrainIcon },
  { value: "activity", label: "Activity", icon: ActivityIcon },
] as const;

export type ObjectiveTabValue = (typeof TABS)[number]["value"];

export interface ObjectiveTabNavProps {
  objective: Objective | null;
  objectiveId: string;
  agentId: string;
  client: SidecarClient;
  activeTab: ObjectiveTabValue;
  isLoading: boolean;
  onResumeRun?: (sessionId: string) => void;
}

export function ObjectiveTabNav({
  objective,
  objectiveId,
  agentId,
  client,
  activeTab,
  isLoading,
  onResumeRun,
}: ObjectiveTabNavProps) {
  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as ObjectiveTabValue;
      if (tab === "overview") {
        window.location.hash = `#objective/${objectiveId}`;
      } else {
        window.location.hash = `#objective/${objectiveId}/${tab}`;
      }
    },
    [objectiveId],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex-1"
    >
      <TabsList>
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value}>
            <Icon className="mr-1.5 size-3" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab objective={objective} isLoading={isLoading} />
      </TabsContent>

      <TabsContent value="runs">
        <RunsTab
          objectiveId={objectiveId}
          client={client}
          onResumeRun={onResumeRun}
        />
      </TabsContent>

      <TabsContent value="artifacts">
        <ArtifactsTab objectiveId={objectiveId} client={client} />
      </TabsContent>

      <TabsContent value="tasks">
        <TasksTab
          agentId={agentId}
          objectiveId={objectiveId}
          client={client}
        />
      </TabsContent>

      <TabsContent value="signals">
        <PlaceholderTab
          title="Signals"
          message="Coming soon — signals will surface relevant opportunities for this objective"
        />
      </TabsContent>

      <TabsContent value="memory">
        <PlaceholderTab
          title="Memory"
          message="Coming soon — objective-specific memory entries will be visible and editable here"
        />
      </TabsContent>

      <TabsContent value="activity">
        <PlaceholderTab
          title="Activity"
          message="Coming soon — a chronological feed of runs, tasks, artifacts, and approvals"
        />
      </TabsContent>
    </Tabs>
  );
}
