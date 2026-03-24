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
    <div className="flex items-center gap-2 border-t border-border/30 px-5 py-3">
      <button
        type="button"
        onClick={onViewChat}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      >
        <MessageSquareIcon className="size-3" />
        View full chat
      </button>
      <button
        type="button"
        onClick={onBackToDashboard}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" />
        Back to dashboard
      </button>
      <button
        type="button"
        onClick={onNewAction}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      >
        <PlusIcon className="size-3" />
        New action
      </button>
    </div>
  );
}
