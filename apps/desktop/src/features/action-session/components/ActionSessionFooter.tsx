import { ArrowLeftIcon, MessageSquareIcon, PlusIcon } from "lucide-react";

interface ActionSessionFooterProps {
  onViewChat: () => void;
  onBackToDashboard: () => void;
  onNewAction: () => void;
}

export function ActionSessionFooter({
  onViewChat,
  onBackToDashboard,
  onNewAction,
}: ActionSessionFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-border/30 bg-card/20 px-5 py-3 dark:border-white/[0.04] dark:bg-white/[0.01]">
      <button
        type="button"
        onClick={onBackToDashboard}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground/70 transition-colors duration-100 hover:bg-muted/30 hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" />
        Back to dashboard
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onViewChat}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all duration-100 hover:border-border/70 hover:bg-muted/20 hover:text-foreground dark:border-white/[0.06] dark:hover:border-white/[0.12]"
        >
          <MessageSquareIcon className="size-3" />
          View full chat
        </button>
        <button
          type="button"
          onClick={onNewAction}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-100 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25"
        >
          <PlusIcon className="size-3" />
          New action
        </button>
      </div>
    </div>
  );
}
