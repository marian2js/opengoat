import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  SkillInstallRequest,
  SkillInstallResult,
} from "@/pages/skills/types";
import {
  Bot,
  Github,
  Globe,
  PackagePlus,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";

interface SkillInstallDialogAgent {
  id: string;
  displayName: string;
  providerId: string;
}

interface SkillInstallDialogProps {
  open: boolean;
  initialScope?: "agent" | "global";
  initialAgentId?: string;
  agents: SkillInstallDialogAgent[];
  defaultAgentId: string;
  isBusy: boolean;
  onInstallSkill: (request: SkillInstallRequest) => Promise<SkillInstallResult>;
  onOpenChange: (open: boolean) => void;
}

export function SkillInstallDialog({
  open,
  initialScope,
  initialAgentId,
  agents,
  defaultAgentId,
  isBusy,
  onInstallSkill,
  onOpenChange,
}: SkillInstallDialogProps): ReactElement {
  const [scope, setScope] = useState<"agent" | "global">("agent");
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSkillName, setSourceSkillName] = useState("");
  const [targetSkillName, setTargetSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [installError, setInstallError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const requestedScope = initialScope === "global" ? "global" : "agent";
    const requestedAgentId = initialAgentId?.trim().toLowerCase();
    const hasRequestedAgent =
      requestedAgentId && agents.some((agent) => agent.id === requestedAgentId);
    const fallbackAgentId =
      agents.find((agent) => agent.id === defaultAgentId)?.id ??
      agents[0]?.id ??
      defaultAgentId;

    setScope(requestedScope);
    setSelectedAgentId((hasRequestedAgent ? requestedAgentId : fallbackAgentId) ?? defaultAgentId);
    setSourceUrl("");
    setSourceSkillName("");
    setTargetSkillName("");
    setDescription("");
    setInstallError(null);
    setSubmitting(false);
  }, [agents, defaultAgentId, initialAgentId, initialScope, open]);

  const selectedAgent = useMemo(() => {
    return agents.find((agent) => agent.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

  const sourceSkillNameNormalized = sourceSkillName.trim();
  const effectiveSkillName =
    targetSkillName.trim() || sourceSkillNameNormalized || "new-skill";

  const installLocations = useMemo(() => {
    if (scope === "global") {
      const providerIds = [...new Set(agents.map((agent) => agent.providerId))];
      return providerIds.map((providerId) =>
        resolveWorkspaceSkillLocation(providerId, effectiveSkillName),
      );
    }

    if (!selectedAgent) {
      return [];
    }

    return [
      resolveWorkspaceSkillLocation(selectedAgent.providerId, effectiveSkillName),
    ];
  }, [agents, effectiveSkillName, scope, selectedAgent]);

  const canSubmit =
    sourceUrl.trim().length > 0 &&
    sourceSkillNameNormalized.length > 0 &&
    (scope === "global" || selectedAgentId.trim().length > 0);

  const handleInstall = async (): Promise<void> => {
    if (!canSubmit || isBusy || isSubmitting) {
      return;
    }

    setInstallError(null);
    setSubmitting(true);
    try {
      const payload: SkillInstallRequest = {
        scope,
        agentId: scope === "agent" ? selectedAgentId : undefined,
        skillName: targetSkillName.trim() || undefined,
        sourceUrl: sourceUrl.trim(),
        sourceSkillName: sourceSkillNameNormalized,
        description: description.trim() || undefined,
        assignToAllAgents: scope === "global",
      };

      await onInstallSkill(payload);
      onOpenChange(false);
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : "Install failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Install Skill</DialogTitle>
          <DialogDescription>
            Add a skill from a repository URL and choose whether to install globally or for one agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={scope === "agent" ? "default" : "outline"}
              className="justify-start"
              onClick={() => {
                setScope("agent");
              }}
              disabled={isBusy || isSubmitting}
            >
              <Bot className="size-4" />
              Install for specific agent
            </Button>
            <Button
              type="button"
              variant={scope === "global" ? "default" : "outline"}
              className="justify-start"
              onClick={() => {
                setScope("global");
              }}
              disabled={isBusy || isSubmitting}
            >
              <Globe className="size-4" />
              Install globally (all agents)
            </Button>
          </div>

          {scope === "agent" ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Target agent
              </p>
              <Select
                value={selectedAgentId}
                onValueChange={(value) => {
                  setSelectedAgentId(value);
                }}
                disabled={isBusy || isSubmitting || agents.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.displayName} ({agent.providerId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Repository URL
            </p>
            <div className="relative">
              <Github className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="https://github.com/anthropics/skills"
                className="pl-9"
                value={sourceUrl}
                onChange={(event) => {
                  setSourceUrl(event.target.value);
                }}
                disabled={isBusy || isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Skill in repository
              </p>
              <Input
                placeholder="frontend-design"
                value={sourceSkillName}
                onChange={(event) => {
                  setSourceSkillName(event.target.value);
                }}
                disabled={isBusy || isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Install as (optional)
              </p>
              <Input
                placeholder="frontend-design"
                value={targetSkillName}
                onChange={(event) => {
                  setTargetSkillName(event.target.value);
                }}
                disabled={isBusy || isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description (optional)
            </p>
            <Input
              placeholder="Short description for runtime context"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              disabled={isBusy || isSubmitting}
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Install preview
            </p>
            <p className="mt-1 text-sm text-foreground">
              {scope === "global"
                ? "Global install + assignment to all agents"
                : `Install for ${selectedAgent?.displayName ?? "selected agent"}`}
            </p>
            <code className="mt-2 block rounded bg-background px-2 py-1 text-xs">
              skill id: {effectiveSkillName}
            </code>
            <div className="mt-2 space-y-1">
              {installLocations.map((location) => (
                <code
                  key={location}
                  className={cn(
                    "block rounded bg-background px-2 py-1 text-xs",
                  )}
                >
                  {location}
                </code>
              ))}
            </div>
          </div>

          {installError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {installError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || isBusy || isSubmitting}
            onClick={() => {
              void handleInstall();
            }}
          >
            <PackagePlus className="size-4" />
            {scope === "global" ? "Install For All Agents" : "Install For Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function resolveWorkspaceSkillLocation(providerId: string, skillId: string): string {
  const normalized = providerId.trim().toLowerCase();
  const skillRoot =
    PROVIDER_SKILL_DIRECTORIES[normalized] ?? PROVIDER_SKILL_DIRECTORIES.openclaw;
  return `${skillRoot}/${skillId}`;
}

const PROVIDER_SKILL_DIRECTORIES: Record<string, string> = {
  openclaw: "skills",
  "claude-code": ".claude/skills",
  codex: ".agents/skills",
  cursor: ".cursor/skills",
  "copilot-cli": ".copilot/skills",
  opencode: ".opencode/skills",
  "gemini-cli": ".gemini/skills",
};
