import type { ArtifactRecord, SpecialistAgent } from "@opengoat/contracts";
import { useEffect, useState } from "react";
import { AlertCircleIcon, LoaderCircleIcon, UsersIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { getActionMapping } from "@/lib/utils/action-map";
import { SpecialistCard } from "./SpecialistCard";

/** Max recent outputs shown per specialist card */
const MAX_OUTPUTS_PER_SPECIALIST = 3;

interface SpecialistTeamBrowserProps {
  client: SidecarClient | null;
  agentId?: string;
}

export function SpecialistTeamBrowser({ client, agentId }: SpecialistTeamBrowserProps) {
  const [specialists, setSpecialists] = useState<SpecialistAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentOutputsMap, setRecentOutputsMap] = useState<Record<string, ArtifactRecord[]>>({});

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!client) {
        if (!cancelled) {
          setSpecialists([]);
          setIsLoading(false);
          setError("Specialists are temporarily unavailable.");
        }
        return;
      }

      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const roster = await client.specialists();
        if (!cancelled) {
          setSpecialists(roster.specialists);
        }
      } catch {
        if (!cancelled) {
          setSpecialists([]);
          setError("Could not load specialists. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Fetch recent artifacts and build per-specialist arrays
  useEffect(() => {
    if (!client || !agentId) return;
    let cancelled = false;

    client
      .listArtifacts({ projectId: agentId, limit: 30 })
      .then((page) => {
        if (cancelled) return;
        const map: Record<string, ArtifactRecord[]> = {};
        for (const artifact of page.items) {
          const specialistId = artifact.createdBy;
          if (!map[specialistId]) {
            map[specialistId] = [];
          }
          if (map[specialistId].length < MAX_OUTPUTS_PER_SPECIALIST) {
            map[specialistId].push(artifact);
          }
        }
        setRecentOutputsMap(map);
      })
      .catch(() => {
        // Silently ignore — recent outputs are non-critical
      });

    return () => { cancelled = true; };
  }, [client, agentId]);

  function handleChat(specialistId: string): void {
    window.location.hash = `#chat?specialist=${encodeURIComponent(specialistId)}`;
  }

  function handleOutputNavigate(artifact: ArtifactRecord): void {
    // Try to find the session via the run ID mapping
    if (artifact.runId) {
      const sessionId = getActionMapping(artifact.runId);
      if (sessionId) {
        window.location.hash = "#chat";
        return;
      }
    }

    // Fallback: navigate to specialist chat if createdBy matches
    if (artifact.createdBy) {
      window.location.hash = `#chat?specialist=${encodeURIComponent(artifact.createdBy)}`;
      return;
    }

    // Last resort: go to general chat
    window.location.hash = "#chat";
  }

  // Separate manager (CMO) from specialists for layout
  const manager = specialists.find((s) => s.category === "manager");
  const operationalSpecialists = specialists.filter(
    (s) => s.category !== "manager",
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
          <UsersIcon className="size-4.5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
            Your AI Marketing Team
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Browse specialists and start a conversation with the right expert.
          </p>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/20 bg-warning/8 px-4 py-3 text-[13px] text-warning-foreground">
          <AlertCircleIcon className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading specialists...
          </div>
        </div>
      ) : specialists.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <UsersIcon className="size-8 text-muted-foreground/40" />
          <p className="text-[13px] text-muted-foreground">
            No specialists available.
          </p>
        </div>
      ) : (
        <>
          {/* CMO / Manager card — full width hero */}
          {manager ? (
            <div>
              <SpecialistCard
                specialist={manager}
                onChat={handleChat}
                recentOutputs={recentOutputsMap[manager.id]}
                onOutputNavigate={handleOutputNavigate}
              />
            </div>
          ) : null}

          {/* Specialist grid — 2 columns */}
          {operationalSpecialists.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {operationalSpecialists.map((specialist) => (
                <SpecialistCard
                  key={specialist.id}
                  specialist={specialist}
                  onChat={handleChat}
                  recentOutputs={recentOutputsMap[specialist.id]}
                  onOutputNavigate={handleOutputNavigate}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
