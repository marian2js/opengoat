import { useState } from "react";
import { BookOpenIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaybookManifest } from "@opengoat/contracts";
import { PlaybookCard } from "@/features/dashboard/components/PlaybookCard";
import { PlaybookStartDialog } from "@/features/dashboard/components/PlaybookStartDialog";

export interface PlaybookLibraryProps {
  playbooks: PlaybookManifest[];
  isLoading: boolean;
  onStartPlaybook?: (playbook: PlaybookManifest) => void;
  isStartingPlaybook?: boolean;
}

export function PlaybookLibrary({
  playbooks,
  isLoading,
  onStartPlaybook,
  isStartingPlaybook,
}: PlaybookLibraryProps) {
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookManifest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCardClick(playbook: PlaybookManifest): void {
    setSelectedPlaybook(playbook);
    setDialogOpen(true);
  }

  function handleStart(playbook: PlaybookManifest): void {
    onStartPlaybook?.(playbook);
  }

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (playbooks.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <BookOpenIcon className="size-3.5 text-primary" />
        <h2 className="section-label">Playbook Library</h2>
      </div>

      {/* Grid */}
      <div className="grid justify-items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:[&>:last-child:nth-child(2n+1)]:col-span-full xl:[&>:last-child:nth-child(2n+1)]:col-auto xl:[&>:last-child:nth-child(3n+1)]:col-span-full">
        {playbooks.map((playbook) => (
          <PlaybookCard
            key={playbook.playbookId}
            playbook={playbook}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {/* Start dialog */}
      <PlaybookStartDialog
        playbook={selectedPlaybook}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStart={handleStart}
        isStarting={isStartingPlaybook}
      />
    </section>
  );
}
