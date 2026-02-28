import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactElement } from "react";

interface AgentsPageAgent {
  id: string;
  displayName: string;
  role?: string;
}

interface AgentsPageProps {
  agents: AgentsPageAgent[];
  isMutating: boolean;
  onSelectAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  renderAgentAvatar: (agent: AgentsPageAgent) => ReactElement;
}

export function AgentsPage({
  agents,
  isMutating,
  onSelectAgent,
  onDeleteAgent,
  renderAgentAvatar,
}: AgentsPageProps): ReactElement {
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">Current organization members.</p>
      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80">
          {agents.map((agent, index) => (
            <div
              key={agent.id}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 bg-background/30 px-4 py-3 transition-colors hover:bg-accent/30",
                index !== agents.length - 1 && "border-b border-border/70",
              )}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectAgent(agent.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectAgent(agent.id);
                }
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {renderAgentAvatar(agent)}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <p className="min-w-0 flex-1 truncate font-medium">
                      {agent.displayName}
                    </p>
                    {agent.role ? (
                      <p className="max-w-[46%] truncate text-right text-xs text-muted-foreground">
                        {agent.role}
                      </p>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{agent.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={agent.id === "goat" || isMutating}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteAgent(agent.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
