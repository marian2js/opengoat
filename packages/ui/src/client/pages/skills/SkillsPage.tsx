import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Skill,
  SkillRemoveRequest,
  SkillRemoveResult,
} from "@/pages/skills/types";
import {
  Globe,
  PackagePlus,
  Sparkles,
  Trash2,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

interface SkillsPageAgent {
  id: string;
  displayName: string;
  providerId: string;
}

interface SkillsPageProps {
  agents: SkillsPageAgent[];
  globalSkills: Skill[];
  skillsByAgentId: Record<string, Skill[]>;
  isBusy: boolean;
  onLoadAgentSkills: (agentId: string) => Promise<void>;
  onOpenInstallSkillModal: (options?: {
    scope?: "agent" | "global";
    agentId?: string;
  }) => void;
  onRemoveSkill: (request: SkillRemoveRequest) => Promise<SkillRemoveResult>;
}

interface AggregatedAgentSkill {
  id: string;
  name: string;
  description: string;
  source: string;
  agents: Array<{
    id: string;
    label: string;
    providerId: string;
  }>;
}

interface PendingRemoval {
  scope: "agent" | "global";
  skillId: string;
  skillName: string;
  agents: Array<{
    id: string;
    label: string;
    providerId: string;
  }>;
}

export function SkillsPage({
  agents,
  globalSkills,
  skillsByAgentId,
  isBusy,
  onLoadAgentSkills,
  onOpenInstallSkillModal,
  onRemoveSkill,
}: SkillsPageProps): ReactElement {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(
    null,
  );
  const [removeAgentId, setRemoveAgentId] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setRemoving] = useState(false);
  const requestedAgentSkillsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const agent of agents) {
      if (skillsByAgentId[agent.id] || requestedAgentSkillsRef.current.has(agent.id)) {
        continue;
      }
      requestedAgentSkillsRef.current.add(agent.id);
      void onLoadAgentSkills(agent.id).catch(() => {
        requestedAgentSkillsRef.current.delete(agent.id);
      });
    }
  }, [agents, onLoadAgentSkills, skillsByAgentId]);

  const globalSkillsSorted = useMemo(() => {
    return [...globalSkills].sort((left, right) => left.name.localeCompare(right.name));
  }, [globalSkills]);

  const aggregatedAgentSkills = useMemo(() => {
    const map = new Map<string, AggregatedAgentSkill>();

    for (const agent of agents) {
      const skills = skillsByAgentId[agent.id] ?? [];
      for (const skill of skills) {
        const current = map.get(skill.id);
        if (!current) {
          map.set(skill.id, {
            id: skill.id,
            name: skill.name,
            description: skill.description,
            source: skill.source,
            agents: [
              {
                id: agent.id,
                label: agent.displayName,
                providerId: agent.providerId,
              },
            ],
          });
          continue;
        }

        if (!current.agents.some((entry) => entry.id === agent.id)) {
          current.agents.push({
            id: agent.id,
            label: agent.displayName,
            providerId: agent.providerId,
          });
        }
      }
    }

    return [...map.values()]
      .map((entry) => ({
        ...entry,
        agents: [...entry.agents].sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [agents, skillsByAgentId]);

  const agentsWithSkillsCount = useMemo(() => {
    return agents.filter((agent) => (skillsByAgentId[agent.id] ?? []).length > 0).length;
  }, [agents, skillsByAgentId]);

  const agentsWithoutSkills = useMemo(() => {
    return agents
      .filter((agent) => (skillsByAgentId[agent.id] ?? []).length === 0)
      .map((agent) => agent.displayName)
      .sort((left, right) => left.localeCompare(right));
  }, [agents, skillsByAgentId]);

  const canSubmitRemoval =
    pendingRemoval !== null &&
    (pendingRemoval.scope === "global" || removeAgentId.trim().length > 0);

  const selectedRemovalAgent = useMemo(() => {
    if (!pendingRemoval || pendingRemoval.scope !== "agent") {
      return null;
    }
    return (
      pendingRemoval.agents.find((agent) => agent.id === removeAgentId) ?? null
    );
  }, [pendingRemoval, removeAgentId]);

  const openGlobalRemoveDialog = (skill: Skill): void => {
    setPendingRemoval({
      scope: "global",
      skillId: skill.id,
      skillName: skill.name,
      agents: [],
    });
    setRemoveAgentId("");
    setRemoveError(null);
    setRemoveDialogOpen(true);
  };

  const openAgentRemoveDialog = (skill: AggregatedAgentSkill): void => {
    setPendingRemoval({
      scope: "agent",
      skillId: skill.id,
      skillName: skill.name,
      agents: skill.agents,
    });
    setRemoveAgentId(skill.agents[0]?.id ?? "");
    setRemoveError(null);
    setRemoveDialogOpen(true);
  };

  const handleRemove = async (): Promise<void> => {
    if (!pendingRemoval || !canSubmitRemoval || isBusy || isRemoving) {
      return;
    }

    setRemoveError(null);
    setRemoving(true);
    try {
      await onRemoveSkill({
        scope: pendingRemoval.scope,
        skillId: pendingRemoval.skillId,
        agentId:
          pendingRemoval.scope === "agent" ? removeAgentId : undefined,
      });
      setRemoveDialogOpen(false);
      setPendingRemoval(null);
      setRemoveAgentId("");
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "Remove failed.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="border-border/80 bg-card">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-foreground" />
                <CardTitle>Skills</CardTitle>
              </div>
              <CardDescription>
                Installed skills overview with aggregated agent coverage.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => {
                onOpenInstallSkillModal({
                  scope: "agent",
                });
              }}
              disabled={isBusy}
            >
              <PackagePlus className="size-4" />
              Install Skill
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              icon={Globe}
              label="Global skills"
              value={String(globalSkillsSorted.length)}
            />
            <MetricTile
              icon={WandSparkles}
              label="Agent skills"
              value={String(aggregatedAgentSkills.length)}
            />
            <MetricTile
              icon={UsersRound}
              label="Agents with skills"
              value={`${agentsWithSkillsCount}/${agents.length}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="text-base">Global Skills</CardTitle>
          <CardDescription>
            Skills installed globally in OpenGoat central storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {globalSkillsSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No global skills installed yet.</p>
          ) : (
            <div className="space-y-2">
              {globalSkillsSorted.map((skill) => (
                <article
                  key={skill.id}
                  className="rounded-lg border border-border/70 bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-sm">{skill.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[11px]">
                        {skill.source}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          openGlobalRemoveDialog(skill);
                        }}
                        disabled={isBusy || isRemoving}
                        aria-label={`Remove global skill ${skill.id}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p
                    className="mt-1 text-xs text-muted-foreground"
                    title={skill.description}
                  >
                    {skill.description || "No description provided."}
                  </p>
                  <code className="mt-2 block text-xs text-muted-foreground">{skill.id}</code>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="text-base">Per-Agent Coverage (Aggregated)</CardTitle>
          <CardDescription>
            Each skill grouped once with all agents where it is installed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {aggregatedAgentSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agent-specific skills installed yet.
            </p>
          ) : (
            <div className="space-y-2">
              {aggregatedAgentSkills.map((skill) => (
                <article
                  key={skill.id}
                  className="rounded-lg border border-border/70 bg-background px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{skill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Installed in {skill.agents.length} agent{skill.agents.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[11px]">
                        {skill.id}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          openAgentRemoveDialog(skill);
                        }}
                        disabled={isBusy || isRemoving}
                        aria-label={`Remove skill ${skill.id} from an agent`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {skill.description || "No description provided."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skill.agents.map((agent) => (
                      <Badge
                        key={`${skill.id}:${agent.id}`}
                        variant="secondary"
                        className="text-[11px]"
                        title={agent.providerId}
                      >
                        {agent.label}
                      </Badge>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {agentsWithoutSkills.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Agents without installed skills
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {agentsWithoutSkills.join(", ")}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          setRemoveDialogOpen(open);
          if (!open) {
            setPendingRemoval(null);
            setRemoveAgentId("");
            setRemoveError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Skill</DialogTitle>
            <DialogDescription>
              {pendingRemoval?.scope === "global"
                ? "Remove this global skill from central storage and all assigned agents."
                : "Choose which agent should have this skill removed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Skill
              </p>
              <p className="mt-1 font-medium text-sm text-foreground">
                {pendingRemoval?.skillName ?? pendingRemoval?.skillId ?? "Unknown"}
              </p>
              <code className="mt-2 block rounded bg-background px-2 py-1 text-xs">
                {pendingRemoval?.skillId ?? "unknown"}
              </code>
            </div>

            {pendingRemoval?.scope === "agent" ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Agent
                </p>
                <Select
                  value={removeAgentId}
                  onValueChange={(value) => {
                    setRemoveAgentId(value);
                  }}
                  disabled={isBusy || isRemoving || pendingRemoval.agents.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingRemoval.agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.label} ({agent.providerId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRemovalAgent ? (
                  <code className="block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {resolveWorkspaceSkillLocation(
                      selectedRemovalAgent.providerId,
                      pendingRemoval?.skillId ?? "",
                    )}
                  </code>
                ) : null}
              </div>
            ) : null}

            {removeError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {removeError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false);
              }}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canSubmitRemoval || isBusy || isRemoving}
              onClick={() => {
                void handleRemove();
              }}
            >
              <Trash2 className="size-4" />
              Remove Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
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
