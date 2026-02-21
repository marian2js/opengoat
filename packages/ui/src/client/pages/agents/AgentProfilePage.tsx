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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PackagePlus, RotateCcw, Save } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_AGENT_ID = "ceo";
const OPENCLAW_PROVIDER_ID = "openclaw";

export interface AgentProfile {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
  reportsTo: string | null;
  type: "manager" | "individual" | "unknown";
  role?: string;
  providerId: string;
  supportsReportees: boolean;
  description: string;
  discoverable: boolean;
  tags: string[];
  priority: number;
  skills: string[];
}

export interface AgentProfileUpdateInput {
  displayName?: string;
  role?: string;
  description?: string;
  type?: "manager" | "individual";
  reportsTo?: string | null;
  providerId?: string;
  discoverable?: boolean;
  tags?: string[];
  priority?: number;
  skills?: string[];
}

interface AgentProfilePageAgent {
  id: string;
  displayName: string;
  reportsTo: string | null;
  providerId: string;
  supportsReportees: boolean;
}

interface AgentProfilePageProvider {
  id: string;
  displayName: string;
  supportsReportees: boolean;
}

interface AgentProfileDraft {
  displayName: string;
  role: string;
  description: string;
  type: "manager" | "individual";
  reportsTo: string;
  discoverable: boolean;
  tags: string;
  priority: string;
}

interface AgentProfilePageProps {
  agentId: string;
  profileRefreshNonce?: number;
  selectedAgent: AgentProfilePageAgent | null;
  agents: AgentProfilePageAgent[];
  providers: AgentProfilePageProvider[];
  isBusy: boolean;
  onLoadProfile: (agentId: string) => Promise<AgentProfile>;
  onSaveProfile: (
    agentId: string,
    payload: AgentProfileUpdateInput,
  ) => Promise<{ agent: AgentProfile; message?: string }>;
  onRefreshOverview: () => Promise<void>;
  onOpenChat: (agentId: string) => void;
  onOpenInstallSkillModal: (agentId: string) => void;
  onBackToAgents: () => void;
}

export function AgentProfilePage({
  agentId,
  profileRefreshNonce = 0,
  selectedAgent,
  agents,
  providers,
  isBusy,
  onLoadProfile,
  onSaveProfile,
  onRefreshOverview,
  onOpenChat,
  onOpenInstallSkillModal,
  onBackToAgents,
}: AgentProfilePageProps): ReactElement {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [draft, setDraft] = useState<AgentProfileDraft | null>(null);
  const [isLoadingProfile, setLoadingProfile] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    setError(null);

    void onLoadProfile(agentId)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setProfile(loaded);
        setDraft(toDraft(loaded));
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }
        setProfile(null);
        setDraft(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the agent profile.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, onLoadProfile, profileRefreshNonce]);

  const directReportCount = useMemo(() => {
    if (!profile) {
      return 0;
    }
    return agents.filter((agent) => agent.reportsTo === profile.id).length;
  }, [agents, profile]);

  const providerById = useMemo(() => {
    return new Map(providers.map((provider) => [provider.id, provider]));
  }, [providers]);

  const managerOptions = useMemo(() => {
    const options = agents.filter((agent) => {
      return (
        agent.id !== agentId &&
        agent.providerId === OPENCLAW_PROVIDER_ID &&
        agent.supportsReportees
      );
    });

    if (!options.some((agent) => agent.id === DEFAULT_AGENT_ID)) {
      options.unshift({
        id: DEFAULT_AGENT_ID,
        displayName: "CEO",
        reportsTo: null,
        providerId: OPENCLAW_PROVIDER_ID,
        supportsReportees: true,
      });
    }

    return options.sort((left, right) => {
      if (left.id === DEFAULT_AGENT_ID && right.id !== DEFAULT_AGENT_ID) {
        return -1;
      }
      if (left.id !== DEFAULT_AGENT_ID && right.id === DEFAULT_AGENT_ID) {
        return 1;
      }
      return left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base",
      });
    });
  }, [agentId, agents]);

  const selectedProvider = profile
    ? providerById.get(profile.providerId)
    : undefined;
  const providerCanHaveReportees = selectedProvider?.supportsReportees !== false;

  const dirty = useMemo(() => {
    if (!profile || !draft) {
      return false;
    }

    const normalizedPriority = Number.parseInt(draft.priority, 10);
    const parsedTags = parseCommaList(draft.tags);

    return (
      draft.displayName.trim() !== profile.displayName ||
      draft.role.trim() !== (profile.role ?? "") ||
      draft.description.trim() !== profile.description ||
      draft.type !== resolveProfileType(profile.type) ||
      normalizeReportTarget(draft.reportsTo, profile.id) !== profile.reportsTo ||
      draft.discoverable !== profile.discoverable ||
      !areStringListsEqual(parsedTags, profile.tags) ||
      Number.isNaN(normalizedPriority) || normalizedPriority !== profile.priority
    );
  }, [draft, profile]);

  if (isLoadingProfile) {
    return (
      <section className="mx-auto w-full max-w-5xl space-y-4">
        <p className="text-sm text-muted-foreground">Loading agent profile...</p>
      </section>
    );
  }

  if (!profile || !draft) {
    return (
      <section className="mx-auto w-full max-w-4xl space-y-4">
        <Card className="border-danger/40 bg-danger/5">
          <CardHeader>
            <CardTitle className="text-base">Agent profile unavailable</CardTitle>
            <CardDescription>
              {error ?? `Unable to resolve agent "${agentId}".`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="secondary" onClick={onBackToAgents}>
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const saveDisabled = isBusy || isSaving || !dirty;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 pb-4">
      <Card className="border-border/70 bg-gradient-to-br from-card to-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {draft.displayName || selectedAgent?.displayName || profile.id}
              </CardTitle>
              <CardDescription className="text-xs">
                @{profile.id}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {draft.type}
              </Badge>
              <Badge variant="outline">
                {selectedProvider?.displayName ?? profile.providerId}
              </Badge>
              <Badge
                variant={draft.discoverable ? "secondary" : "outline"}
                className={cn(!draft.discoverable && "text-muted-foreground")}
              >
                {draft.discoverable ? "Discoverable" : "Hidden"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            Direct reportees: <span className="font-medium text-foreground">{directReportCount}</span>
          </p>
          <p>
            Reports to: <span className="font-medium text-foreground">{profile.reportsTo ?? "none"}</span>
          </p>
          <p>
            Workspace: <span className="font-mono text-foreground">{profile.workspaceDir}</span>
          </p>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>Basic information and role details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="agent-profile-display-name">
                Display Name
              </label>
              <Input
                id="agent-profile-display-name"
                value={draft.displayName}
                disabled={isBusy || isSaving}
                onChange={(event) => {
                  setDraft((current) => {
                    if (!current) {
                      return current;
                    }
                    return {
                      ...current,
                      displayName: event.target.value,
                    };
                  });
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="agent-profile-role">
                Role
              </label>
              <Input
                id="agent-profile-role"
                value={draft.role}
                disabled={isBusy || isSaving}
                onChange={(event) => {
                  setDraft((current) => {
                    if (!current) {
                      return current;
                    }
                    return {
                      ...current,
                      role: event.target.value,
                    };
                  });
                }}
                placeholder="Manager"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="agent-profile-description">
                Description
              </label>
              <Textarea
                id="agent-profile-description"
                value={draft.description}
                disabled={isBusy || isSaving}
                rows={5}
                onChange={(event) => {
                  setDraft((current) => {
                    if (!current) {
                      return current;
                    }
                    return {
                      ...current,
                      description: event.target.value,
                    };
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>Hierarchy placement and visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Type
                </label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => {
                    if (value !== "manager" && value !== "individual") {
                      return;
                    }
                    setDraft((current) => {
                      if (!current) {
                        return current;
                      }
                      return {
                        ...current,
                        type: value,
                      };
                    });
                  }}
                  disabled={isBusy || isSaving || profile.id === DEFAULT_AGENT_ID}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Reports To
                </label>
                <Select
                  value={draft.reportsTo}
                  onValueChange={(value) => {
                    setDraft((current) => {
                      if (!current) {
                        return current;
                      }
                      return {
                        ...current,
                        reportsTo: value,
                      };
                    });
                  }}
                  disabled={
                    isBusy ||
                    isSaving ||
                    profile.id === DEFAULT_AGENT_ID ||
                    managerOptions.length === 0
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only OpenClaw agents can be selected as manager.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="agent-profile-priority">
                  Priority
                </label>
                <Input
                  id="agent-profile-priority"
                  type="number"
                  value={draft.priority}
                  disabled={isBusy || isSaving}
                  onChange={(event) => {
                    setDraft((current) => {
                      if (!current) {
                        return current;
                      }
                      return {
                        ...current,
                        priority: event.target.value,
                      };
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Discoverable
                </label>
                <div className="flex h-10 items-center justify-between rounded-md border border-input px-3">
                  <span className="text-sm text-foreground">
                    {draft.discoverable ? "Visible in org" : "Hidden in org"}
                  </span>
                  <Switch
                    checked={draft.discoverable}
                    disabled={isBusy || isSaving}
                    onCheckedChange={(checked) => {
                      setDraft((current) => {
                        if (!current) {
                          return current;
                        }
                        return {
                          ...current,
                          discoverable: checked,
                        };
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="agent-profile-tags">
                Tags
              </label>
              <Input
                id="agent-profile-tags"
                value={draft.tags}
                disabled={isBusy || isSaving}
                onChange={(event) => {
                  setDraft((current) => {
                    if (!current) {
                      return current;
                    }
                    return {
                      ...current,
                      tags: event.target.value,
                    };
                  });
                }}
                placeholder="manager, leadership"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime</CardTitle>
            <CardDescription>Provider runtime configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Provider
              </label>
              <Select
                value={profile.providerId}
                disabled
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!providerCanHaveReportees && directReportCount > 0 ? (
              <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                This provider does not support reportees, but this agent currently
                has {directReportCount} direct reportee{directReportCount === 1 ? "" : "s"}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Skills</CardTitle>
                <CardDescription>Assigned skills for this agent.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy || isSaving}
                onClick={() => {
                  onOpenInstallSkillModal(profile.id);
                }}
              >
                <PackagePlus className="size-4" />
                Add Skill
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Assigned Skills
            </label>
            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skillId) => (
                  <Badge key={skillId} variant="secondary" className="font-mono text-[11px]">
                    {skillId}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                No assigned skills.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paths</CardTitle>
            <CardDescription>Runtime file locations for this agent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-muted-foreground">Workspace directory</p>
            <p className="rounded-md border border-border/70 bg-background/60 px-3 py-2 font-mono text-foreground break-all">
              {profile.workspaceDir}
            </p>
            <p className="text-muted-foreground">Config file</p>
            <p className="rounded-md border border-border/70 bg-background/60 px-3 py-2 font-mono text-foreground break-all">
              {profile.internalConfigDir}/config.json
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes" : "No unsaved changes"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onBackToAgents}
            disabled={isBusy || isSaving}
          >
            Back to Agents
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onOpenChat(profile.id);
            }}
            disabled={isBusy || isSaving}
          >
            Open Chat
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy || isSaving || !dirty}
            onClick={() => {
              setError(null);
              setDraft(toDraft(profile));
            }}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button
            size="sm"
            disabled={saveDisabled}
            onClick={() => {
              void saveAgentProfile({
                profile,
                draft,
                onSaveProfile,
                onRefreshOverview,
                setProfile,
                setDraft,
                setError,
                setSaving,
              });
            }}
          >
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function toDraft(profile: AgentProfile): AgentProfileDraft {
  return {
    displayName: profile.displayName,
    role: profile.role ?? "",
    description: profile.description,
    type: resolveProfileType(profile.type),
    reportsTo: profile.reportsTo ?? DEFAULT_AGENT_ID,
    discoverable: profile.discoverable,
    tags: profile.tags.join(", "),
    priority: String(profile.priority),
  };
}

function resolveProfileType(type: AgentProfile["type"]): "manager" | "individual" {
  return type === "manager" ? "manager" : "individual";
}

function normalizeReportTarget(value: string, agentId: string): string | null {
  if (agentId === DEFAULT_AGENT_ID) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized || DEFAULT_AGENT_ID;
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function areStringListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

async function saveAgentProfile(options: {
  profile: AgentProfile;
  draft: AgentProfileDraft;
  onSaveProfile: (
    agentId: string,
    payload: AgentProfileUpdateInput,
  ) => Promise<{ agent: AgentProfile; message?: string }>;
  onRefreshOverview: () => Promise<void>;
  setProfile: (value: AgentProfile) => void;
  setDraft: (value: AgentProfileDraft) => void;
  setError: (value: string | null) => void;
  setSaving: (value: boolean) => void;
}): Promise<void> {
  const {
    profile,
    draft,
    onSaveProfile,
    onRefreshOverview,
    setProfile,
    setDraft,
    setError,
    setSaving,
  } = options;

  const displayName = draft.displayName.trim();
  if (!displayName) {
    setError("Display name is required.");
    return;
  }

  const priority = Number.parseInt(draft.priority, 10);
  if (Number.isNaN(priority)) {
    setError("Priority must be a number.");
    return;
  }

  const payload: AgentProfileUpdateInput = {};
  const role = draft.role.trim();
  const description = draft.description.trim();
  const reportsTo = normalizeReportTarget(draft.reportsTo, profile.id);
  const tags = parseCommaList(draft.tags);

  if (displayName !== profile.displayName) {
    payload.displayName = displayName;
  }
  if (role !== (profile.role ?? "")) {
    payload.role = role;
  }
  if (description !== profile.description) {
    payload.description = description;
  }
  if (draft.type !== resolveProfileType(profile.type)) {
    payload.type = draft.type;
  }
  if (reportsTo !== profile.reportsTo) {
    payload.reportsTo = reportsTo;
  }
  if (draft.discoverable !== profile.discoverable) {
    payload.discoverable = draft.discoverable;
  }
  if (!areStringListsEqual(tags, profile.tags)) {
    payload.tags = tags;
  }
  if (priority !== profile.priority) {
    payload.priority = priority;
  }
  if (Object.keys(payload).length === 0) {
    toast.message("No changes to save.");
    return;
  }

  setSaving(true);
  setError(null);

  try {
    const response = await onSaveProfile(profile.id, payload);
    setProfile(response.agent);
    setDraft(toDraft(response.agent));
    toast.success(response.message ?? `Agent "${response.agent.id}" updated.`);
    await onRefreshOverview();
  } catch (requestError) {
    const message =
      requestError instanceof Error
        ? requestError.message
        : "Unable to update the agent profile.";
    setError(message);
    toast.error(message);
  } finally {
    setSaving(false);
  }
}
