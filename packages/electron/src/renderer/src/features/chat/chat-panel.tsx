import { Button } from "@renderer/components/ui/button";
import { Textarea } from "@renderer/components/ui/textarea";
import type { WorkbenchMessage, WorkbenchProject, WorkbenchSession } from "@shared/workbench";
import { Send } from "lucide-react";

interface ChatPanelProps {
  homeDir: string;
  activeProject: WorkbenchProject | null;
  activeSession: WorkbenchSession | null;
  messages: WorkbenchMessage[];
  error: string | null;
  draft: string;
  canSend: boolean;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenOnboarding: () => void;
  onDismissError: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  return (
    <main className="flex min-w-0 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div>
          <p className="font-heading text-lg">
            {props.activeProject?.name ?? "No project selected"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {props.activeSession
              ? `Session: ${props.activeSession.title}`
              : "Create a session to start chatting"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={props.onOpenOnboarding}
          disabled={props.busy}
        >
          Provider Setup
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {props.messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-foreground)]">
            Messages will appear here. OpenGoat always talks to the orchestrator internally.
          </div>
        ) : (
          <div className="space-y-3">
            {props.messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-3xl rounded-lg border px-4 py-3 ${
                  message.role === "user"
                    ? "ml-auto border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <p className="mb-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {message.role === "user" ? "You" : "OpenGoat"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                {message.tracePath ? (
                  <p className="mt-2 truncate text-xs text-[var(--muted-foreground)]">
                    Trace: {message.tracePath}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        {props.error ? (
          <div className="mb-3 flex items-center justify-between rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <span>{props.error}</span>
            <Button size="sm" variant="ghost" onClick={props.onDismissError}>
              Dismiss
            </Button>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Textarea
            value={props.draft}
            onChange={(event) => props.onDraftChange(event.target.value)}
            placeholder={
              props.activeSession
                ? "Describe what you want OpenGoat to do..."
                : "Create a session first, then send a message"
            }
            disabled={!props.activeSession || props.busy}
            className="min-h-[88px]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (props.canSend) {
                  props.onSend();
                }
              }
            }}
          />
          <div className="flex w-40 flex-col justify-between">
            <Button onClick={props.onSend} disabled={!props.canSend}>
              <Send className="size-4" />
              Send
            </Button>
            <p className="text-xs text-[var(--muted-foreground)]">{props.homeDir}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
