import type { Agent, ResolvedSkillContract } from "@opengoat/contracts";
import {
  AlertCircleIcon,
  DownloadIcon,
  LoaderCircleIcon,
  PackageIcon,
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
      } finally {
        setRemovingId(null);
      }
    },
    [agent.id, client, loadSkills],
  );

  const extraSkills = skills.filter((s) => s.source === "extra");
  const managedSkills = skills.filter((s) => s.source === "managed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Skills</CardTitle>
        <CardDescription>Extend your AI CMO with additional capabilities.</CardDescription>
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
            {/* Installed extra skills */}
            {extraSkills.length > 0 ? (
              <div className="space-y-2">
                <span className="block text-[12px] font-medium text-muted-foreground" role="heading" aria-level={3}>
                  Installed skills
                </span>
                <div className="divide-y divide-border rounded-md border">
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
                <span className="block text-[12px] font-medium text-muted-foreground" role="heading" aria-level={3}>
                  Built-in skills
                </span>
                <div className="divide-y divide-border rounded-md border">
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

            {/* Empty state */}
            {skills.length === 0 ? (
              <p className="py-3 text-center text-[13px] text-muted-foreground">
                No custom skills installed. Your AI CMO works out of the box with built-in capabilities.
              </p>
            ) : null}

            {/* Install form */}
            <div className="space-y-2">
              <label htmlFor="skill-install-input" className="block text-[12px] font-medium text-muted-foreground">
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
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
