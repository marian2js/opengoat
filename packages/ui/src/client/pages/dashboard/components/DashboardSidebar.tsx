import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  SidebarVersionStatus,
  type SidebarVersionInfo,
} from "@/pages/dashboard/components/SidebarVersionStatus";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Settings,
} from "lucide-react";
import type { ComponentType, DragEvent, ReactElement } from "react";

export interface DashboardSidebarNavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  hiddenInSidebar?: boolean;
}

export interface DashboardSidebarSessionItem {
  agentId: string;
  sessionId: string;
  sessionKey: string;
  title: string;
  updatedAt: number;
}

export interface DashboardSidebarAgentItem {
  id: string;
  displayName: string;
  roleLabel: string;
}

export interface DashboardSidebarAgentSessions {
  agent: DashboardSidebarAgentItem;
  sessions: DashboardSidebarSessionItem[];
  visibleLimit: number;
}

export interface DashboardSidebarDropTarget {
  agentId: string;
  position: "before" | "after";
}

interface DashboardSidebarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  items: DashboardSidebarNavItem[];
  isItemActive: (itemId: string) => boolean;
  onSelectItem: (itemId: string) => void;
  sidebarSessionsByAgent: DashboardSidebarAgentSessions[];
  activeSidebarAgentId: string | null;
  activeSessionId: string | null;
  expandedAgentSessionIds: Set<string>;
  openSessionMenuId: string | null;
  isMutating: boolean;
  isLoading: boolean;
  draggingSidebarAgentId: string | null;
  sidebarDropTarget: DashboardSidebarDropTarget | null;
  onSidebarListDragOver: (event: DragEvent<HTMLElement>) => void;
  onSidebarListDrop: (event: DragEvent<HTMLElement>) => void;
  onSidebarAgentDragStart: (
    agentId: string,
    event: DragEvent<HTMLElement>,
  ) => void;
  onSidebarAgentDragOver: (
    agentId: string,
    event: DragEvent<HTMLElement>,
  ) => void;
  onSidebarAgentDrop: (agentId: string, event: DragEvent<HTMLElement>) => void;
  onSidebarAgentDragEnd: () => void;
  onSelectSidebarAgent: (agentId: string) => void | Promise<void>;
  onCreateAgentSession: (agentId: string) => void | Promise<void>;
  onToggleAgentExpanded: (agentId: string) => void;
  onToggleSessionMenu: (sessionMenuId: string) => void;
  onCloseSessionMenu: () => void;
  onRenameSession: (
    session: DashboardSidebarSessionItem,
  ) => void | Promise<void>;
  onRemoveSession: (
    session: DashboardSidebarSessionItem,
  ) => void | Promise<void>;
  onSelectSession: (session: DashboardSidebarSessionItem) => void;
  versionInfo: SidebarVersionInfo | null;
  isVersionLoading: boolean;
  isSettingsActive: boolean;
  onOpenSettings: () => void;
  renderAgentAvatar: (params: {
    agentId: string;
    displayName: string;
    size?: "xs" | "sm" | "md";
  }) => ReactElement;
}

export function DashboardSidebar({
  isSidebarCollapsed,
  onToggleSidebar,
  items,
  isItemActive,
  onSelectItem,
  sidebarSessionsByAgent,
  activeSidebarAgentId,
  activeSessionId,
  expandedAgentSessionIds,
  openSessionMenuId,
  isMutating,
  isLoading,
  draggingSidebarAgentId,
  sidebarDropTarget,
  onSidebarListDragOver,
  onSidebarListDrop,
  onSidebarAgentDragStart,
  onSidebarAgentDragOver,
  onSidebarAgentDrop,
  onSidebarAgentDragEnd,
  onSelectSidebarAgent,
  onCreateAgentSession,
  onToggleAgentExpanded,
  onToggleSessionMenu,
  onCloseSessionMenu,
  onRenameSession,
  onRemoveSession,
  onSelectSession,
  versionInfo,
  isVersionLoading,
  isSettingsActive,
  onOpenSettings,
  renderAgentAvatar,
}: DashboardSidebarProps): ReactElement {
  return (
    <aside
      className={cn(
        "opengoat-sidebar hidden border-r border-border bg-card transition-[width] duration-200 md:flex md:flex-col",
        isSidebarCollapsed ? "md:w-16" : "md:w-64",
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-accent text-base leading-none">
          <span aria-hidden="true">🐐</span>
        </div>
        {!isSidebarCollapsed ? (
          <p className="ml-2 text-sm font-semibold">OpenGoat UI</p>
        ) : null}
        <button
          type="button"
          className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onToggleSidebar}
          aria-label={
            isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="size-4 icon-stroke-1_2" />
          ) : (
            <ChevronLeft className="size-4 icon-stroke-1_2" />
          )}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {!isSidebarCollapsed ? (
          <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
            Main Menu
          </p>
        ) : null}
        {items
          .filter((item) => !item.hiddenInSidebar)
          .map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.id);

            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => onSelectItem(item.id)}
                className={cn(
                  "mb-1 flex w-full items-center rounded-lg border px-3 py-2.5 text-[14px] font-medium transition-colors",
                  active
                    ? "border-border bg-accent/90 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
                  isSidebarCollapsed && "justify-center px-2",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!isSidebarCollapsed ? (
                  <span className="ml-2">{item.label}</span>
                ) : null}
              </button>
            );
          })}

        <Separator className="my-2 bg-border/70" />
        {!isSidebarCollapsed ? (
          <>
            <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              Agents & Sessions
            </p>
            <div
              className="space-y-1"
              onDragOver={onSidebarListDragOver}
              onDrop={onSidebarListDrop}
            >
              {sidebarSessionsByAgent.map(({ agent, sessions, visibleLimit }) => {
                const isAgentActive = activeSidebarAgentId === agent.id;
                const isExpanded = expandedAgentSessionIds.has(agent.id);
                const hasHiddenSessions = sessions.length > visibleLimit;
                const visibleSessions = isExpanded
                  ? sessions
                  : sessions.slice(0, visibleLimit);
                const dropIndicatorPosition =
                  draggingSidebarAgentId &&
                  draggingSidebarAgentId !== agent.id &&
                  sidebarDropTarget?.agentId === agent.id
                    ? sidebarDropTarget.position
                    : null;

                return (
                  <div
                    key={agent.id}
                    data-sidebar-agent-id={agent.id}
                    draggable
                    onDragStart={(event) => {
                      onSidebarAgentDragStart(agent.id, event);
                    }}
                    onDragOver={(event) => {
                      onSidebarAgentDragOver(agent.id, event);
                    }}
                    onDrop={(event) => {
                      onSidebarAgentDrop(agent.id, event);
                    }}
                    onDragEnd={onSidebarAgentDragEnd}
                    className={cn(
                      "relative rounded-lg border px-1 py-1 transition-colors cursor-grab active:cursor-grabbing",
                      isAgentActive
                        ? "border-border/80 bg-accent/35"
                        : draggingSidebarAgentId
                        ? "border-transparent"
                        : "border-transparent hover:border-border/50 hover:bg-accent/20",
                      draggingSidebarAgentId === agent.id && "opacity-60",
                      dropIndicatorPosition !== null && "border-primary/60",
                    )}
                  >
                    {dropIndicatorPosition ? (
                      <span
                        className={cn(
                          "pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background))]",
                          dropIndicatorPosition === "before"
                            ? "-top-px"
                            : "-bottom-px",
                        )}
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="group/agent flex items-center">
                      <button
                        type="button"
                        title={`Open ${agent.displayName}`}
                        onClick={() => {
                          void onSelectSidebarAgent(agent.id);
                        }}
                        className="flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-left"
                      >
                        {renderAgentAvatar({
                          agentId: agent.id,
                          displayName: agent.displayName,
                          size: "xs",
                        })}
                        <div className="ml-2 min-w-0">
                          <p
                            className={cn(
                              "truncate text-[13px] font-semibold leading-tight",
                              isAgentActive
                                ? "text-foreground"
                                : "text-foreground/95",
                            )}
                          >
                            {agent.displayName}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 truncate text-[11px] font-normal leading-tight",
                              isAgentActive
                                ? "text-muted-foreground"
                                : "text-muted-foreground/90",
                            )}
                          >
                            {agent.roleLabel}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`New session with ${agent.displayName}`}
                        title="New session"
                        disabled={isMutating || isLoading}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void onCreateAgentSession(agent.id);
                        }}
                        className="mr-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/agent:opacity-100 disabled:opacity-40"
                      >
                        <Plus className="size-3.5 icon-stroke-1" />
                      </button>
                    </div>

                    {visibleSessions.length > 0 ? (
                      <div className="space-y-0.5 pb-1">
                        {visibleSessions.map((session) => (
                          <SidebarSessionRow
                            key={`${agent.id}:${session.sessionId}`}
                            session={session}
                            activeSessionId={activeSessionId}
                            openSessionMenuId={openSessionMenuId}
                            isMutating={isMutating}
                            onSelectSession={onSelectSession}
                            onToggleSessionMenu={onToggleSessionMenu}
                            onRenameSession={onRenameSession}
                            onRemoveSession={onRemoveSession}
                          />
                        ))}
                        {hasHiddenSessions ? (
                          <button
                            type="button"
                            onClick={() => {
                              onToggleAgentExpanded(agent.id);
                              onCloseSessionMenu();
                            }}
                            className="flex w-full items-center rounded-md px-3 py-1 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                          >
                            <span
                              className="inline-block size-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="ml-2">
                              {isExpanded
                                ? "Show less"
                                : `Show more (${sessions.length - visibleLimit})`}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div
            className="space-y-1"
            onDragOver={onSidebarListDragOver}
            onDrop={onSidebarListDrop}
          >
            {sidebarSessionsByAgent.map(({ agent }) => {
              const isAgentActive = activeSidebarAgentId === agent.id;
              const dropIndicatorPosition =
                draggingSidebarAgentId &&
                draggingSidebarAgentId !== agent.id &&
                sidebarDropTarget?.agentId === agent.id
                  ? sidebarDropTarget.position
                  : null;

              return (
                <button
                  key={agent.id}
                  type="button"
                  data-sidebar-agent-id={agent.id}
                  draggable
                  onDragStart={(event) => {
                    onSidebarAgentDragStart(agent.id, event);
                  }}
                  onDragOver={(event) => {
                    onSidebarAgentDragOver(agent.id, event);
                  }}
                  onDrop={(event) => {
                    onSidebarAgentDrop(agent.id, event);
                  }}
                  onDragEnd={onSidebarAgentDragEnd}
                  title={agent.displayName}
                  onClick={() => {
                    void onSelectSidebarAgent(agent.id);
                  }}
                  className={cn(
                    "relative flex w-full items-center justify-center rounded-lg border py-2 transition-colors",
                    isAgentActive
                      ? "border-border bg-accent/90"
                      : draggingSidebarAgentId
                      ? "border-transparent"
                      : "border-transparent hover:border-border/60 hover:bg-accent/60",
                    draggingSidebarAgentId === agent.id && "opacity-60",
                    dropIndicatorPosition !== null && "border-primary/60",
                  )}
                >
                  {dropIndicatorPosition ? (
                    <span
                      className={cn(
                        "pointer-events-none absolute left-1 right-1 z-10 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_hsl(var(--background))]",
                        dropIndicatorPosition === "before"
                          ? "-top-px"
                          : "-bottom-px",
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                  {renderAgentAvatar({
                    agentId: agent.id,
                    displayName: agent.displayName,
                  })}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <div
          className={cn(
            "flex items-center gap-2",
            isSidebarCollapsed ? "flex-col justify-center" : "justify-between",
          )}
        >
          <SidebarVersionStatus
            versionInfo={versionInfo}
            isVersionLoading={isVersionLoading}
            isSidebarCollapsed={isSidebarCollapsed}
          />

          <button
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={onOpenSettings}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
              isSettingsActive
                ? "border-border bg-accent/90 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarSessionRow({
  session,
  activeSessionId,
  openSessionMenuId,
  isMutating,
  onSelectSession,
  onToggleSessionMenu,
  onRenameSession,
  onRemoveSession,
}: {
  session: DashboardSidebarSessionItem;
  activeSessionId: string | null;
  openSessionMenuId: string | null;
  isMutating: boolean;
  onSelectSession: (session: DashboardSidebarSessionItem) => void;
  onToggleSessionMenu: (sessionMenuId: string) => void;
  onRenameSession: (session: DashboardSidebarSessionItem) => void | Promise<void>;
  onRemoveSession: (session: DashboardSidebarSessionItem) => void | Promise<void>;
}): ReactElement {
  const sessionMenuId = `${session.agentId}:${session.sessionId}`;
  const isActiveSession = activeSessionId === session.sessionId;

  return (
    <div className="group/session relative">
      <button
        type="button"
        title={`${session.title} (${session.sessionKey})`}
        onClick={() => {
          onSelectSession(session);
        }}
        className={cn(
          "flex w-full items-center rounded-md px-3 py-1.5 pr-8 text-left text-[13px] transition-colors",
          isActiveSession
            ? "bg-accent/75 text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <span className="inline-block size-4 shrink-0" aria-hidden="true" />
        <span className="ml-2 truncate">{session.title}</span>
      </button>
      <button
        type="button"
        aria-label={`Session menu for ${session.title}`}
        title="Session menu"
        disabled={isMutating}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleSessionMenu(sessionMenuId);
        }}
        className={cn(
          "absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50",
          openSessionMenuId === sessionMenuId
            ? "opacity-100"
            : "opacity-0 group-hover/session:opacity-100",
        )}
      >
        <MoreHorizontal className="size-3.5" />
      </button>
      {openSessionMenuId === sessionMenuId ? (
        <div className="absolute right-1 top-8 z-20 min-w-[120px] rounded-md border border-border bg-card p-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent/80"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onRenameSession(session);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onRemoveSession(session);
            }}
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
