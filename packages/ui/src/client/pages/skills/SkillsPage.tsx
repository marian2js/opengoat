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
  Skill,
  SkillInstallRequest,
  SkillInstallResult,
} from "@/pages/skills/types";
import {
  Bot,
  Github,
  Globe,
  PackagePlus,
  Sparkles,
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
  defaultAgentId: string;
  isBusy: boolean;
  onLoadAgentSkills: (agentId: string) => Promise<void>;
  onInstallSkill: (
    request: SkillInstallRequest,
  ) => Promise<SkillInstallResult>;
}

interface AggregatedAgentSkill {
  id: string;
  name: string;
  description: string;
  source: string;
  agentIds: string[];
  agentLabels: string[];
}

export function SkillsPage({
  agents,
  globalSkills,
  skillsByAgentId,
  defaultAgentId,
  isBusy,
  onLoadAgentSkills,
  onInstallSkill,
}: SkillsPageProps): ReactElement {
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [scope, setScope] = useState<"agent" | "global">("agent");
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSkillName, setSourceSkillName] = useState("");
  const [targetSkillName, setTargetSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [installError, setInstallError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const requestedAgentSkillsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0]?.id ?? defaultAgentId);
      return;
    }
    if (!agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agents[0]?.id ?? defaultAgentId);
    }
  }, [agents, defaultAgentId, selectedAgentId]);

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

  const selectedAgent = useMemo(() => {
    return agents.find((agent) => agent.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

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
            agentIds: [agent.id],
            agentLabels: [agent.displayName],
          });
          continue;
        }

        if (!current.agentIds.includes(agent.id)) {
          current.agentIds.push(agent.id);
          current.agentLabels.push(agent.displayName);
        }
      }
    }

    return [...map.values()]
      .map((entry) => ({
        ...entry,
        agentIds: [...entry.agentIds].sort((left, right) => left.localeCompare(right)),
        agentLabels: [...entry.agentLabels].sort((left, right) => left.localeCompare(right)),
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
      setInstallDialogOpen(false);
      setInstallError(null);
      setSourceUrl("");
      setSourceSkillName("");
      setTargetSkillName("");
      setDescription("");
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : "Install failed.");
    } finally {
      setSubmitting(false);
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
                setInstallDialogOpen(true);
                setInstallError(null);
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
                    <Badge variant="secondary" className="text-[11px]">
                      {skill.source}
                    </Badge>
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
                        Installed in {skill.agentIds.length} agent{skill.agentIds.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      {skill.id}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skill.agentLabels.map((agentLabel) => (
                      <Badge
                        key={`${skill.id}:${agentLabel}`}
                        variant="secondary"
                        className="text-[11px]"
                      >
                        {agentLabel}
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

      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
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
                setInstallDialogOpen(false);
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
