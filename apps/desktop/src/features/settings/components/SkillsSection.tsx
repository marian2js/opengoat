import type { Agent, ResolvedSkillContract } from "@opengoat/contracts";
import {
  AlertCircleIcon,
  DownloadIcon,
  LoaderCircleIcon,
  PackageIcon,
  PuzzleIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import type { SidecarClient } from "@/lib/sidecar/client";

interface SkillsSectionProps {
  agent: Agent;
  client: SidecarClient;
}

export function SkillsSection({ agent, client }: SkillsSectionProps) {
  const [skills, setSkills] = useState<ResolvedSkillContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Install form state
  const [installInput, setInstallInput] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Track which skill is being removed
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      setError(null);
      const result = await client.listSkills(agent.id);
      setSkills(result.skills);
    } catch (err) {
      console.error("Failed to load skills", err);
      setError("Failed to load skills.");
    } finally {
      setIsLoading(false);
    }
  }, [agent.id, client]);

  useEffect(() => {
    setIsLoading(true);
    void loadSkills();
  }, [loadSkills]);

  const handleInstall = useCallback(async () => {
    const value = installInput.trim();
    if (!value) return;

    setIsInstalling(true);
    setInstallError(null);

    try {
      const isUrl = value.startsWith("http://") || value.startsWith("https://") || value.includes("github.com");
      await client.installSkill(agent.id, {
        skillName: isUrl ? value.split("/").pop() || value : value,
        ...(isUrl ? { sourceUrl: value } : {}),
      });
      setInstallInput("");
      await loadSkills();
    } catch (err) {
      console.error("Failed to install skill", err);
      setInstallError("Failed to install skill. Check the name or URL and try again.");
    } finally {
      setIsInstalling(false);
    }
  }, [agent.id, client, installInput, loadSkills]);

  const handleRemove = useCallback(
    async (skillId: string) => {
      setRemovingId(skillId);
      try {
        await client.removeSkill(agent.id, skillId);
        await loadSkills();
      } catch (err) {
        console.error("Failed to remove skill", err);
        setError("Failed to remove skill. Please try again.");
      } finally {
        setRemovingId(null);
      }
    },
    [agent.id, client, loadSkills],
  );

  const extraSkills = skills.filter((s) => s.source === "extra");
  const managedSkills = skills.filter((s) => s.source === "managed");

  return (
    <Card className="overflow-hidden rounded-xl border-border/40 shadow-sm shadow-black/[0.02] transition-all duration-150 hover:border-border/60 hover:shadow-md dark:border-white/[0.06] dark:shadow-black/10 dark:hover:border-white/[0.10]">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/8">
            <PuzzleIcon className="size-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="text-[14px] font-semibold">Skills</CardTitle>
              <CardDescription className="text-[12px]">Extend your AI CMO with additional capabilities.</CardDescription>
            </div>
          </div>
          {!isLoading && managedSkills.length > 0 ? (
            <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
              {managedSkills.length} active
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-3 text-[13px] text-muted-foreground">
            <LoaderCircleIcon className="size-3.5 animate-spin" />
            Loading skills...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-3 text-[13px] text-destructive">
            <AlertCircleIcon className="size-3.5" />
            {error}
          </div>
        ) : (
          <>
            {/* Bundled skills summary */}
            {managedSkills.length > 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5 dark:bg-white/[0.02]">
                <SparklesIcon className="size-4 shrink-0 text-primary/70" />
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">{managedSkills.length} bundled marketing skills active</span>
                  {" — included with your AI CMO"}
                </p>
              </div>
            ) : null}

            {/* Installed extra skills */}
            {extraSkills.length > 0 ? (
              <div className="space-y-2">
                <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60" role="heading" aria-level={3}>
                  Installed skills
                </span>
                <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/40 dark:divide-white/[0.04] dark:border-white/[0.06]">
                  {extraSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <PackageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-[13px] font-medium">{skill.name}</span>
                        </div>
                        {skill.description ? (
                          <p className="mt-0.5 truncate pl-[22px] text-[12px] text-muted-foreground">
                            {skill.description}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[12px] text-muted-foreground hover:text-destructive"
                        disabled={removingId === skill.id}
                        onClick={() => void handleRemove(skill.id)}
                      >
                        {removingId === skill.id ? (
                          <LoaderCircleIcon className="size-3 animate-spin" />
                        ) : (
                          <TrashIcon className="size-3" />
                        )}
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Built-in/managed skills (read-only) */}
            {managedSkills.length > 0 ? (
              <div className="space-y-2">
                <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60" role="heading" aria-level={3}>
                  Built-in skills
                </span>
                <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/40 dark:divide-white/[0.04] dark:border-white/[0.06]">
                  {managedSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <PackageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-[13px] font-medium">{skill.name}</span>
                          <Badge variant="secondary" className="text-[10px]">built-in</Badge>
                        </div>
                        {skill.description ? (
                          <p className="mt-0.5 truncate pl-[22px] text-[12px] text-muted-foreground">
                            {skill.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Empty state — only for custom/extra skills */}
            {extraSkills.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/30 px-4 py-4 dark:border-white/[0.04]">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 dark:bg-white/[0.03]">
                  <SparklesIcon className="size-4 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-muted-foreground">
                    No additional skills installed
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground/50">
                    Install custom skills below to extend beyond bundled capabilities.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Install form */}
            <div className="space-y-2">
              <label htmlFor="skill-install-input" className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Install a skill
              </label>
              <div className="flex gap-2">
                <Input
                  id="skill-install-input"
                  className="h-9 flex-1 text-[13px]"
                  placeholder="Skill name or GitHub URL"
                  value={installInput}
                  onChange={(e) => {
                    setInstallInput(e.target.value);
                    if (installError) setInstallError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && installInput.trim()) {
                      void handleInstall();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-9 shrink-0 text-[13px]"
                  disabled={!installInput.trim() || isInstalling}
                  onClick={() => void handleInstall()}
                >
                  {isInstalling ? (
                    <>
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="size-3.5" />
                      Install
                    </>
                  )}
                </Button>
              </div>
              {installError ? (
                <p className="text-[12px] text-destructive">{installError}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste a skill repository URL to install, e.g. github.com/user/skill-name
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
