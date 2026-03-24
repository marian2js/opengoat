import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useObjectiveList } from "@/features/board/hooks/useObjectiveList";
import type { SidecarClient } from "@/lib/sidecar/client";

interface ObjectivePickerProps {
  agentId: string;
  client: SidecarClient;
  currentObjectiveId?: string;
  onSelect: (objectiveId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ObjectivePicker({
  agentId,
  client,
  currentObjectiveId,
  onSelect,
  onClear,
  onClose,
}: ObjectivePickerProps) {
  const { objectives, isLoading } = useObjectiveList(agentId, client);
  const overlayRef = useRef<HTMLDivElement>(null);

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
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="absolute left-4 top-full z-50 mt-1 w-72 rounded-lg border border-border/60 bg-popover p-1 shadow-lg ring-1 ring-foreground/5 lg:left-6"
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Change Objective
        </span>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/50 hover:text-muted-foreground"
          onClick={onClose}
        >
          <XIcon className="size-3" />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : objectives.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground/50">
            No objectives found
          </div>
        ) : (
          objectives.map((obj) => (
            <button
              key={obj.objectiveId}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => onSelect(obj.objectiveId)}
            >
              <span className="min-w-0 flex-1 truncate">{obj.title}</span>
              {obj.objectiveId === currentObjectiveId ? (
                <CheckIcon className="size-3.5 shrink-0 text-primary" />
              ) : null}
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border/40 px-2 py-1.5">
        <button
          type="button"
          className="w-full rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
          onClick={onClear}
        >
          Clear scope
        </button>
      </div>
    </div>
  );
}
