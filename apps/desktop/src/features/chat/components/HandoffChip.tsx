import { ArrowRightIcon, XIcon } from "lucide-react";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { getSpecialistColors } from "@/features/agents/specialist-meta";

const HANDOFF_CONTEXT_KEY = "opengoat:handoffContext";

export interface HandoffContext {
  sourceSpecialist: string;
  summary: string;
  timestamp: number;
}

interface HandoffChipProps {
  specialistId: string;
  specialistName: string;
  reason: string;
  currentSpecialistName?: string | undefined;
  onDismiss: () => void;
  onNavigate?: ((specialistId: string) => void) | undefined;
}

/** Known specialist ID → icon key mapping (matches specialist-registry.ts). */
const SPECIALIST_ICON_MAP: Record<string, string> = {
  cmo: "brain",
  "market-intel": "search",
  positioning: "target",
  "website-conversion": "layout",
  "seo-aeo": "globe",
  distribution: "megaphone",
  content: "pen-tool",
  outbound: "send",
};

export function writeHandoffContext(context: HandoffContext): void {
  try {
    sessionStorage.setItem(HANDOFF_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage errors
  }
}

export function readHandoffContext(): HandoffContext | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HandoffContext;
    // Only accept context from the last 30 seconds
    if (Date.now() - parsed.timestamp > 30_000) {
      sessionStorage.removeItem(HANDOFF_CONTEXT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearHandoffContext(): void {
  try {
    sessionStorage.removeItem(HANDOFF_CONTEXT_KEY);
  } catch {
    // Ignore
  }
}

function truncateReason(reason: string, maxLength = 80): string {
  if (reason.length <= maxLength) return reason;
  return `${reason.slice(0, maxLength - 1)}…`;
}

export function HandoffChip({
  specialistId,
  specialistName,
  reason,
  currentSpecialistName,
  onDismiss,
  onNavigate,
}: HandoffChipProps) {
  const iconKey = SPECIALIST_ICON_MAP[specialistId] ?? "bot";
  const IconComponent = resolveSpecialistIcon(iconKey);
  const colors = getSpecialistColors(specialistId);

  const handleClick = () => {
    const sourceName = currentSpecialistName ?? "Chat";
    const summary = `Continuing from ${sourceName}: ${reason}`;
    writeHandoffContext({
      sourceSpecialist: sourceName,
      summary,
      timestamp: Date.now(),
    });
    if (onNavigate) {
      onNavigate(specialistId);
    } else {
      console.warn(
        `[HandoffChip] No onNavigate callback for specialist "${specialistId}", falling back to hash navigation`,
      );
      window.location.hash = `#chat?specialist=${encodeURIComponent(specialistId)}`;
    }
  };

  return (
    <button
      type="button"
      className="group/handoff mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border/30 bg-muted/15 px-3 py-2 text-left transition-all duration-150 hover:-translate-y-px hover:border-primary/25 hover:bg-muted/30 hover:shadow-sm"
      onClick={handleClick}
    >
      <div className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors ${colors.iconBg}`}>
        <IconComponent className={`size-3.5 ${colors.iconText}`} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold text-foreground/80 transition-colors group-hover/handoff:text-foreground">
          {specialistName}
        </span>
        <p className="truncate text-[10px] leading-snug text-muted-foreground/60">
          {truncateReason(reason)}
        </p>
      </div>
      <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground/20 transition-all group-hover/handoff:translate-x-0.5 group-hover/handoff:text-primary" />
      <button
        type="button"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/20 transition-colors hover:text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <XIcon className="size-2.5" />
      </button>
    </button>
  );
}
