import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Boxes,
  Bot,
  Github,
  Globe,
  PackagePlus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";

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

export function SkillsPage({
  agents,
  globalSkills,
  skillsByAgentId,
  defaultAgentId,
  isBusy,
  onLoadAgentSkills,
  onInstallSkill,
}: SkillsPageProps): ReactElement {
  const [scope, setScope] = useState<"agent" | "global">("agent");
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSkillName, setSourceSkillName] = useState("");
  const [targetSkillName, setTargetSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [installError, setInstallError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

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
    if (!selectedAgentId) {
      return;
    }
    void onLoadAgentSkills(selectedAgentId).catch(() => {
      // handled by parent toasts
    });
  }, [onLoadAgentSkills, selectedAgentId]);

  const selectedAgent = useMemo(() => {
    return agents.find((agent) => agent.id === selectedAgentId) ?? null;
  }, [agents, selectedAgentId]);

  const selectedAgentSkills =
    (selectedAgentId ? skillsByAgentId[selectedAgentId] : undefined) ?? [];

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
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : "Install failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-amber-50 via-card to-emerald-50">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-600" />
              <CardTitle>Skill Installer</CardTitle>
            </div>
            <Badge variant="secondary">URL-first flow</Badge>
          </div>
          <CardDescription>
            Install from GitHub and apply to one agent or every agent in your org.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              icon={Boxes}
              label="Global skills"
              value={String(globalSkills.length)}
            />
            <MetricTile
              icon={Bot}
              label="Agents"
              value={String(agents.length)}
            />
            <MetricTile
              icon={UserRound}
              label="Selected agent skills"
              value={String(selectedAgentSkills.length)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Add New Skill</CardTitle>
            <CardDescription>
              Provide repository URL + skill name. Target scope decides where it is installed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <UserRound className="size-4" />
                Specific agent
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
                Global (all agents)
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

            {installError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {installError}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={!canSubmit || isBusy || isSubmitting}
              onClick={() => {
                void handleInstall();
              }}
            >
              <PackagePlus className="size-4" />
              {scope === "global" ? "Install For All Agents" : "Install For Agent"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Install Preview</CardTitle>
            <CardDescription>
              Preview of where this skill will be written based on provider runtime policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Scope
              </p>
              <p className="mt-1 font-medium">
                {scope === "global"
                  ? "Global install + assignment to all agents"
                  : `Agent install for ${selectedAgent?.displayName ?? "selected agent"}`}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Effective skill id
              </p>
              <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">
                {effectiveSkillName}
              </code>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Workspace locations
              </p>
              {installLocations.map((location) => (
                <code
                  key={location}
                  className="block rounded-md border border-border/70 bg-background/60 px-2 py-1 text-xs"
                >
                  {location}
                </code>
              ))}
              {installLocations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Select an agent to preview installation paths.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SkillListCard title="Global Skills" skills={globalSkills} />
        <SkillListCard
          title={selectedAgent ? `${selectedAgent.displayName} Skills` : "Agent Skills"}
          skills={selectedAgentSkills}
          emptyLabel={
            selectedAgent
              ? "No skills installed for this agent yet."
              : "Select an agent to view installed skills."
          }
        />
      </div>
    </section>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SkillListCard({
  title,
  skills,
  emptyLabel,
}: {
  title: string;
  skills: Skill[];
  emptyLabel?: string;
}): ReactElement {
  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {skills.length > 0
            ? `${skills.length} installed`
            : (emptyLabel ?? "No installed skills.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel ?? "No skills installed."}</p>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className={cn(
                  "rounded-lg border border-border/70 bg-background/60 px-3 py-2",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-sm">{skill.name}</p>
                  <Badge variant="secondary" className="text-[11px]">
                    {skill.source}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={skill.description}>
                  {skill.description}
                </p>
                <code className="mt-2 block text-xs text-muted-foreground">{skill.id}</code>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
