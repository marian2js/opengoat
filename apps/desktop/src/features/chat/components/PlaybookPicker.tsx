import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, PlayIcon, XIcon } from "lucide-react";
import type { PlaybookManifest } from "@opengoat/contracts";
import type { ChatScope } from "@/features/chat/lib/chat-scope";
import type { SidecarClient } from "@/lib/sidecar/client";

interface PlaybookPickerProps {
  client: SidecarClient;
  agentId: string;
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;
  sessionId: string;
  onClose: () => void;
}

export function PlaybookPicker({
  client,
  agentId,
  scope,
  setScope,
  sessionId,
  onClose,
}: PlaybookPickerProps) {
  const [playbooks, setPlaybooks] = useState<PlaybookManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void client.listPlaybooks().then((res) => {
      if (!cancelled) {
        setPlaybooks(res.playbooks);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [client]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleStart = async (playbook: PlaybookManifest) => {
    const objectiveId =
      scope.type === "objective" ? scope.objectiveId :
      scope.type === "run" ? scope.objectiveId :
      undefined;

    if (!objectiveId) {
      // Can't start a playbook without an objective — close and let user create one first
      onClose();
      return;
    }

    setStartingId(playbook.playbookId);
    try {
      const run = await client.createRun({
        agentId,
        objectiveId,
        playbookId: playbook.playbookId,
        projectId: agentId,
        sessionId,
        startedFrom: "chat",
        title: playbook.title,
      });
      setScope({ type: "run", objectiveId, runId: run.runId });
      onClose();
    } catch {
      setStartingId(null);
    }
  };

  const hasObjective = scope.type === "objective" || scope.type === "run";

  return (
    <div
      ref={overlayRef}
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border/60 bg-popover p-1 shadow-lg ring-1 ring-foreground/5"
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Start a Playbook
        </span>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50 hover:text-muted-foreground"
          onClick={onClose}
        >
          <XIcon className="size-3" />
        </button>
      </div>

      {!hasObjective ? (
        <div className="px-2 py-3 text-center text-[11px] text-muted-foreground/60">
          Create or attach an objective first to start a playbook run.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-4">
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground/40" />
        </div>
      ) : playbooks.length === 0 ? (
        <div className="px-2 py-4 text-center text-[11px] text-muted-foreground/50">
          No playbooks available
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {playbooks.map((pb) => (
            <button
              key={pb.playbookId}
              type="button"
              disabled={startingId !== null}
              className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              onClick={() => void handleStart(pb)}
            >
              <PlayIcon className="mt-0.5 size-3 shrink-0 text-primary/60" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{pb.title}</span>
                <span className="line-clamp-2 text-[10px] text-muted-foreground/60">
                  {pb.description}
                </span>
              </div>
              {startingId === pb.playbookId ? (
                <LoaderCircleIcon className="mt-0.5 size-3 animate-spin text-primary" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
