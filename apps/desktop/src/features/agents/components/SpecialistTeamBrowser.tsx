import type { SpecialistAgent } from "@opengoat/contracts";
import { useEffect, useState } from "react";
import { AlertCircleIcon, LoaderCircleIcon, UsersIcon } from "lucide-react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { SpecialistCard } from "./SpecialistCard";

interface SpecialistTeamBrowserProps {
  client: SidecarClient | null;
}

export function SpecialistTeamBrowser({ client }: SpecialistTeamBrowserProps) {
  const [specialists, setSpecialists] = useState<SpecialistAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  function handleChat(specialistId: string): void {
    window.location.hash = `#chat?specialist=${encodeURIComponent(specialistId)}`;
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
              <SpecialistCard specialist={manager} onChat={handleChat} />
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
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
