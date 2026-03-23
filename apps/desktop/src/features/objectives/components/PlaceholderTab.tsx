import { InboxIcon } from "lucide-react";

export interface PlaceholderTabProps {
  title: string;
  message?: string;
}

export function PlaceholderTab({
  title,
  message = "Coming soon — this feature is under development",
}: PlaceholderTabProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-muted/50 p-3">
        <InboxIcon className="size-6 text-muted-foreground/40" />
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground/80">
        {title}
      </h3>
      <p className="max-w-xs text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
