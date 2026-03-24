import { useState } from "react";
import {
  BookmarkIcon,
  CheckIcon,
  LoaderCircleIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import type { MemoryCategory, MemoryScope } from "@opengoat/contracts";
import type { ChatScope } from "@/features/chat/lib/chat-scope";
import type { SidecarClient } from "@/lib/sidecar/client";

interface MemoryCandidateChipProps {
  candidateId: string;
  content: string;
  suggestedCategory: MemoryCategory;
  suggestedScope: MemoryScope;
  confidence: number;
  scope: ChatScope;
  client: SidecarClient;
  agentId: string;
  onDismiss: (candidateId: string) => void;
}

const CATEGORY_LABELS: Partial<Record<MemoryCategory, string>> = {
  brand_voice: "Brand Voice",
  channels_to_avoid: "Avoid",
  competitors: "Competitors",
  founder_preferences: "Preference",
  icp_facts: "ICP",
  product_facts: "Product",
};

export function MemoryCandidateChip({
  candidateId,
  content,
  suggestedCategory,
  suggestedScope,
  confidence,
  scope,
  client,
  agentId,
  onDismiss,
}: MemoryCandidateChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const objectiveId =
    scope.type === "objective" ? scope.objectiveId :
    scope.type === "run" ? scope.objectiveId :
    undefined;

  const handleSave = async (text: string) => {
    setIsSaving(true);
    try {
      await client.createMemory({
        category: suggestedCategory,
        confidence,
        content: text,
        createdBy: "system",
        ...(objectiveId ? { objectiveId } : {}),
        projectId: agentId,
        scope: suggestedScope,
        source: "chat",
        userConfirmed: true,
      });
      setSaved(true);
    } catch {
      // Silently fail — user can try again
      setIsSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-md border border-green-500/20 bg-green-500/[0.06] px-2.5 py-1.5 text-[11px] text-green-600 dark:text-green-400">
        <CheckIcon className="size-3" />
        <span>Saved to Brain</span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-border/40 bg-muted/20 px-3 py-2">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <BookmarkIcon className="mt-0.5 size-3 shrink-0 text-primary/50" />
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <textarea
              className="w-full resize-none rounded-md border border-border/50 bg-background px-2 py-1.5 text-[11px] text-foreground focus:border-primary/40 focus:outline-none"
              rows={2}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
            />
          ) : (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/80">
              {content}
            </p>
          )}
          <span className="mt-1 inline-block rounded-sm bg-primary/8 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary/60">
            {CATEGORY_LABELS[suggestedCategory] ?? suggestedCategory}
          </span>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:text-muted-foreground"
          onClick={() => onDismiss(candidateId)}
        >
          <XIcon className="size-2.5" />
        </button>
      </div>

      {/* Actions */}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/8 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
          onClick={() => void handleSave(isEditing ? editedContent : content)}
        >
          {isSaving ? (
            <LoaderCircleIcon className="size-2.5 animate-spin" />
          ) : (
            <BookmarkIcon className="size-2.5" />
          )}
          Save
        </button>
        {!isEditing ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            <PencilIcon className="size-2.5" />
            Edit
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
              setIsEditing(false);
              setEditedContent(content);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
