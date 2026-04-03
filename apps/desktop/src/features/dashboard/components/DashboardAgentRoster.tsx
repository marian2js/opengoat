import type { SpecialistAgent } from "@opengoat/contracts";
import { UsersIcon } from "lucide-react";
import { DashboardSpecialistChip } from "@/features/dashboard/components/DashboardSpecialistChip";

interface DashboardAgentRosterProps {
  specialists: SpecialistAgent[];
  onChat: (specialistId: string) => void;
}

export function DashboardAgentRoster({ specialists, onChat }: DashboardAgentRosterProps) {
  if (specialists.length === 0) return null;

  const manager = specialists.find((s) => s.category === "manager");
  const operationalSpecialists = specialists.filter((s) => s.category !== "manager");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <UsersIcon className="size-3 text-primary" />
        </div>
        <h2 className="section-label">Your AI Team</h2>
      </div>

      {/* CMO — full-width hero position */}
      {manager ? (
        <DashboardSpecialistChip specialist={manager} onChat={onChat} />
      ) : null}

      {/* Operational specialists — responsive grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {operationalSpecialists.map((specialist) => (
          <DashboardSpecialistChip
            key={specialist.id}
            specialist={specialist}
            onChat={onChat}
          />
        ))}
      </div>
    </section>
  );
}
