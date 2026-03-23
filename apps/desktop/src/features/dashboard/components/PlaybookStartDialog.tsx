import {
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  ClockIcon,
  LoaderIcon,
  PlayIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlaybookManifest } from "@opengoat/contracts";

export interface PlaybookStartDialogProps {
  playbook: PlaybookManifest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart?: (playbook: PlaybookManifest) => void;
  isStarting?: boolean;
}

export function PlaybookStartDialog({
  playbook,
  open,
  onOpenChange,
  onStart,
  isStarting,
}: PlaybookStartDialogProps) {
  if (!playbook) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {playbook.goalTypes.map((goalType) => (
              <Badge key={goalType} variant="outline" className="text-[10px]">
                {goalType}
              </Badge>
            ))}
          </div>
          <DialogTitle className="font-display text-lg font-bold">
            {playbook.title}
          </DialogTitle>
          <DialogDescription>{playbook.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Best for */}
          <div>
            <h4 className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Best for
            </h4>
            <p className="text-sm text-foreground/80">{playbook.idealFor}</p>
          </div>

          {/* Phases */}
          <div>
            <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Phases
            </h4>
            <ol className="flex flex-col gap-1.5">
              {playbook.defaultPhases.map((phase, idx) => (
                <li key={phase.name} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[9px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-sm font-medium">{phase.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {" — "}
                      {phase.description}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Expected deliverables */}
          <div>
            <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Expected deliverables
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {playbook.artifactTypes.map((artifact) => (
                <Badge
                  key={artifact}
                  variant="outline"
                  className="text-[10px] text-muted-foreground"
                >
                  <CheckCircleIcon className="mr-1 size-2.5" />
                  {artifact}
                </Badge>
              ))}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 border-t border-border/30 pt-3">
            {playbook.timeToFirstValue ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="size-3" />
                {playbook.timeToFirstValue}
              </span>
            ) : null}
            {playbook.createsTrackedWork ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClipboardListIcon className="size-3" />
                Creates tracked tasks
              </span>
            ) : null}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpenIcon className="size-3" />
              {playbook.defaultPhases.length} phases
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            className="gap-1.5"
            disabled={isStarting}
            onClick={() => {
              onStart?.(playbook);
            }}
          >
            {isStarting ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <PlayIcon className="size-3.5" />
            )}
            {isStarting ? "Starting…" : "Start playbook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
