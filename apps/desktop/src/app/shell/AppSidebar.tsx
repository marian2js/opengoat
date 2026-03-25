import type { AgentCatalog, AgentSession } from "@opengoat/contracts";
import type { ActionSessionMeta } from "@/features/action-session/types";
import {
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  TrashIcon,
  ZapIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { getActionSessionMeta } from "@/features/action-session/lib/action-session-state";
import { isLikelyActionSession, markActionSession } from "@/features/chat/components/ChatWorkspace";
import {
  brainNavigation,
  primaryNavigation,
  secondaryNavigation,
} from "@/app/config/navigation";
import {
  resolveDomain as sharedResolveDomain,
  buildFaviconSources as sharedBuildFaviconSources,
} from "@/lib/utils/favicon";
import { baseLabel } from "@/lib/utils/base-label";
import { formatShortTime } from "@/lib/utils/format-short-time";
import { groupSessionsByDate } from "@/lib/utils/group-sessions-by-date";
import { simplifyDateGroups } from "@/lib/utils/simplify-date-groups";
import { getDeEmphasizedSessionIds } from "@/lib/utils/session-rerun";
import { humanizeSessionLabel } from "@/lib/utils/session-label";
import { isUnnamedSession } from "@/lib/utils/unnamed-session";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";


const MAX_VISIBLE = 5;

interface AppSidebarProps {
  activeAgentId?: string | undefined;
  activeBrainSection?: string | undefined;
  activeSessionId?: string | undefined;
  activeView: "dashboard" | "connections" | "chat" | "brain" | "agents" | "settings" | "board";
  agentCatalog: AgentCatalog | null;
  isActionSession?: ((sessionId: string) => boolean) | undefined;
  onAddProject?: (() => void) | undefined;
  onNewChat?: (() => void) | undefined;
  onProjectSwitch?: ((agentId: string) => void) | undefined;
  onSessionDelete?: ((sessionId: string) => void) | undefined;
  onSessionRename?: ((sessionId: string, label: string) => void) | undefined;
  onSessionSelect?: ((sessionId: string) => void) | undefined;
  sessions?: AgentSession[] | undefined;
}

function formatSessionLabel(session: AgentSession): string {
  return humanizeSessionLabel(session.label, session.createdAt);
}

export function AppSidebar({
  activeAgentId,
  activeBrainSection,
  activeSessionId,
  activeView,
  agentCatalog,
  isActionSession,
  onAddProject,
  onNewChat,
  onProjectSwitch,
  onSessionDelete,
  onSessionRename,
  onSessionSelect,
  sessions,
}: AppSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const allSessions = sessions ?? [];
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return allSessions;
    const q = searchQuery.trim().toLowerCase();
    return allSessions.filter((s) => {
      const label = humanizeSessionLabel(s.label, s.createdAt);
      return label.toLowerCase().includes(q);
    });
  }, [allSessions, searchQuery]);
  // Hide unnamed (empty) sessions — keep the active session visible so the
  // user can still see a thread they just created via "New chat".
  const displaySessions = useMemo(
    () =>
      filteredSessions.filter(
        (s) => s.id === activeSessionId || !isUnnamedSession(s.label),
      ),
    [filteredSessions, activeSessionId],
  );
  const sessionGroups = useMemo(
    () => simplifyDateGroups(groupSessionsByDate(displaySessions)),
    [displaySessions],
  );
  const deEmphasizedIds = useMemo(
    () => getDeEmphasizedSessionIds(allSessions),
    [allSessions],
  );
  const checkIsAction = useCallback(
    (sessionId: string) => isActionSession?.(sessionId) ?? false,
    [isActionSession],
  );
  const projects = resolveAllProjects(agentCatalog, activeAgentId);
  const activeProject = projects.find((p) => p.isActive) ?? projects[0];

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="h-11 data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#dashboard">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayoutDashboardIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="font-display text-[13px] font-bold tracking-tight">
                    OpenGoat
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Primary nav: Dashboard, Chat */}
              {primaryNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={item.href.slice(1) === activeView}
                  >
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Brain — collapsible */}
              <Collapsible
                defaultOpen={activeView === "brain"}
                asChild
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      tooltip="Brain"
                      isActive={activeView === "brain"}
                    >
                      <a href="#brain">
                        <BrainIcon />
                        <span>Brain</span>
                        <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </a>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {brainNavigation.map((item) => {
                        const isSubActive =
                          activeView === "brain" &&
                          item.href === `#brain/${activeBrainSection}`;
                        return (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isSubActive}
                              className={cn(
                                isSubActive &&
                                  "border-l-2 border-primary font-medium",
                              )}
                            >
                              <a href={item.href}>
                                <item.icon />
                                <span>{item.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Divider before secondary nav */}
              <div className="mx-2 my-1 h-px bg-sidebar-border/60" />

              {/* Secondary nav: Agents, Connections (Settings excluded — in footer) */}
              {secondaryNavigation
                .filter((item) => item.href !== "#settings")
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={item.href.slice(1) === activeView}
                    >
                      <a href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {activeView === "chat" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            {onNewChat ? (
              <SidebarGroupAction title="New chat" onClick={onNewChat}>
                <PlusIcon />
                <span className="sr-only">New chat</span>
              </SidebarGroupAction>
            ) : null}
            <SidebarGroupContent>
              <div className="px-2 pb-1">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chats…"
                    className="h-7 w-full rounded-md border border-sidebar-border bg-sidebar pl-7 pr-2 text-[13px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>
              {sessionGroups.length > 0 ? (
                <SidebarMenu>
                  {sessionGroups.map((group) => {
                    const isRecent = group.label === "Today" || group.label === "Yesterday";
                    const isSearching = searchQuery.trim().length > 0;
                    const defaultOpen = group.label === "Today" || isSearching;
                    const isGroupExpanded = expandedGroups.has(group.label);
                    const isCapped = !isGroupExpanded && group.sessions.length > MAX_VISIBLE;
                    const visibleSessions = isCapped ? group.sessions.slice(0, MAX_VISIBLE) : group.sessions;
                    const hiddenCount = group.sessions.length - visibleSessions.length;
                    // Detect duplicate labels within this group —
                    // strip trailing dedup suffixes like " (16)" so
                    // "Launch on Product Hunt (15)" and "(16)" are
                    // recognised as the same base name.
                    const labelCounts = new Map<string, number>();
                    for (const s of group.sessions) {
                      const l = baseLabel(formatSessionLabel(s));
                      labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
                    }
                    const duplicateLabels = new Set(
                      [...labelCounts.entries()].filter(([, c]) => c > 1).map(([l]) => l),
                    );
                    return (
                      <Collapsible
                        key={group.label}
                        defaultOpen={defaultOpen}
                        open={isSearching ? true : undefined}
                        asChild
                        className="group/dategroup"
                      >
                        <li role="none">
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center gap-1.5 px-3 pt-3 pb-1 text-left"
                            >
                              <ChevronRightIcon className="size-3 text-primary/60 transition-transform duration-150 group-data-[state=open]/dategroup:rotate-90" />
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                                {group.label}
                              </span>
                              <span className="font-mono text-[10px] font-normal text-sidebar-foreground/40">
                                {group.sessions.length}
                              </span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ul role="group" className="flex flex-col">
                              {visibleSessions.map((session) => {
                                let sessionIsAction = checkIsAction(session.id);
                                if (!sessionIsAction && session.label && isLikelyActionSession(session.label)) {
                                  sessionIsAction = true;
                                  markActionSession(session.id); // backfill localStorage
                                }
                                const label = formatSessionLabel(session);
                                const timestamp = duplicateLabels.has(baseLabel(label))
                                  ? formatShortTime(session.createdAt)
                                  : undefined;
                                return (
                                  <SessionItem
                                    key={session.id}
                                    actionMeta={sessionIsAction ? getActionSessionMeta(session.id) : null}
                                    deEmphasized={deEmphasizedIds.has(session.id)}
                                    isAction={sessionIsAction}
                                    isActive={session.id === activeSessionId}
                                    isEditing={editingSessionId === session.id}
                                    isRecent={isRecent}
                                    session={session}
                                    timestamp={timestamp}
                                    onDelete={onSessionDelete}
                                    onRename={onSessionRename}
                                    onSelect={onSessionSelect}
                                    onStartEditing={() => setEditingSessionId(session.id)}
                                    onStopEditing={() => setEditingSessionId(null)}
                                  />
                                );
                              })}
                              {hiddenCount > 0 && (
                                <li className="px-3 py-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setExpandedGroups((prev) => { const next = new Set(prev); next.add(group.label); return next; }); }}
                                    className="text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
                                  >
                                    Show {hiddenCount} more
                                  </button>
                                </li>
                              )}
                              {isGroupExpanded && group.sessions.length > MAX_VISIBLE && (
                                <li className="px-3 py-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setExpandedGroups((prev) => { const next = new Set(prev); next.delete(group.label); return next; }); }}
                                    className="text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
                                  >
                                    Show less
                                  </button>
                                </li>
                              )}
                            </ul>
                          </CollapsibleContent>
                        </li>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              ) : allSessions.length > 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-sidebar-foreground/50">
                  No chats match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : null}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

      </SidebarContent>

      <SidebarFooter>
        {activeProject ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <ProjectIcon
                      domain={activeProject.domain}
                      faviconSources={activeProject.faviconSources}
                    />
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-[12px] font-medium">
                        {activeProject.domain}
                      </span>
                      <span className="truncate text-[11px] text-sidebar-foreground/45">
                        {projects.length} {projects.length === 1 ? "project" : "projects"}
                      </span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4 text-sidebar-foreground/30" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Projects
                  </DropdownMenuLabel>
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.agentId}
                      onClick={() => onProjectSwitch?.(project.agentId)}
                      className="gap-2"
                    >
                      <ProjectIcon
                        domain={project.domain}
                        faviconSources={project.faviconSources}
                      />
                      <span className="flex-1 truncate text-[13px]">
                        {project.domain}
                      </span>
                      {project.isActive ? (
                        <CheckIcon className="size-3.5 text-primary" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onAddProject?.()}
                    className="gap-2"
                  >
                    <div className="flex size-5 items-center justify-center rounded-sm border border-dashed border-muted-foreground/30">
                      <PlusIcon className="size-3 text-muted-foreground" />
                    </div>
                    <span className="text-[13px]">Add project</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <SidebarMenuAction asChild>
                <a
                  href="#settings"
                  className="text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  title="Settings"
                >
                  <Settings2Icon className="size-4" />
                  <span className="sr-only">Settings</span>
                </a>
              </SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

interface ProjectInfo {
  agentId: string;
  domain: string;
  faviconSources: string[];
  isActive: boolean;
}

// Re-export shared utilities under local names for backward compatibility
const resolveDomain = sharedResolveDomain;
const buildFaviconSources = sharedBuildFaviconSources;

function resolveAllProjects(
  catalog: AgentCatalog | null,
  activeAgentId?: string,
): ProjectInfo[] {
  if (!catalog) {
    return [];
  }

  return catalog.agents
    .filter((a) => a.id.endsWith("-main"))
    .map((agent) => {
      const domain = resolveDomain(agent);
      const faviconSources = buildFaviconSources(domain);

      return {
        agentId: agent.id,
        domain,
        faviconSources,
        isActive: agent.id === activeAgentId,
      };
    });
}

function ProjectIcon({
  domain,
  faviconSources,
}: {
  domain: string;
  faviconSources: string[];
}) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const allFailed = sourceIndex >= faviconSources.length;

  return (
    <div className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-sidebar-accent">
      {!allFailed && faviconSources.length > 0 ? (
        <img
          alt={domain}
          className="size-3.5 rounded-sm"
          src={faviconSources[sourceIndex]}
          onError={() => setSourceIndex((prev) => prev + 1)}
        />
      ) : (
        <GlobeIcon className="size-3 text-sidebar-foreground/50" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action session status badge helpers
// ---------------------------------------------------------------------------

const STATE_BADGE_MAP: Record<string, { label: string; color: string }> = {
  working: { label: "WORKING", color: "text-primary/70" },
  "needs-input": { label: "INPUT", color: "text-amber-400" },
  "ready-to-review": { label: "REVIEW", color: "text-primary" },
  "saved-to-board": { label: "SAVED", color: "text-sidebar-foreground/50" },
  done: { label: "DONE", color: "text-sidebar-foreground/40" },
};

// ---------------------------------------------------------------------------
// Session item
// ---------------------------------------------------------------------------

function SessionItem({
  actionMeta,
  deEmphasized,
  isAction,
  isActive,
  isEditing,
  isRecent,
  session,
  timestamp,
  onDelete,
  onRename,
  onSelect,
  onStartEditing,
  onStopEditing,
}: {
  actionMeta: ActionSessionMeta | null;
  deEmphasized: boolean;
  isAction: boolean;
  isActive: boolean;
  isEditing: boolean;
  isRecent: boolean;
  session: AgentSession;
  timestamp?: string | undefined;
  onDelete?: ((sessionId: string) => void) | undefined;
  onRename?: ((sessionId: string, label: string) => void) | undefined;
  onSelect?: ((sessionId: string) => void) | undefined;
  onStartEditing: () => void;
  onStopEditing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = formatSessionLabel(session);
  const unnamed = isUnnamedSession(session.label);
  const Icon = isAction ? ZapIcon : MessageSquareIcon;
  const badge = isAction && actionMeta ? STATE_BADGE_MAP[actionMeta.state] : null;

  function commitRename(): void {
    const value = inputRef.current?.value.trim();
    if (value && value !== label) {
      onRename?.(session.id, value);
    }
    onStopEditing();
  }

  if (isEditing) {
    return (
      <SidebarMenuItem>
        <div className="flex h-8 items-center gap-2 px-2">
          <Icon className={cn("size-4 shrink-0", isAction ? "text-primary" : "text-sidebar-foreground/70")} />
          <input
            ref={inputRef}
            autoFocus
            defaultValue={label}
            className="h-6 min-w-0 flex-1 rounded border border-sidebar-ring bg-sidebar px-1.5 text-sm text-sidebar-foreground outline-none focus:ring-1 focus:ring-sidebar-ring"
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRename();
              } else if (event.key === "Escape") {
                onStopEditing();
              }
            }}
          />
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={label}
        isActive={isActive}
        onClick={() => {
          onSelect?.(session.id);
        }}
        className={cn(
          isActive && "border-l-2 border-primary bg-primary/5",
          deEmphasized && !isActive && "opacity-45",
          unnamed && !isActive && "text-sidebar-foreground/50",
        )}
      >
        <Icon className={cn("shrink-0", isAction && "text-primary")} />
        <span className={cn(
          "truncate",
          unnamed
            ? "italic"
            : isRecent
              ? "font-medium"
              : "font-normal",
        )}>{label}</span>
        {timestamp ? <span className="shrink-0 text-[11px] font-normal text-sidebar-foreground/40"> · {timestamp}</span> : null}
        {badge ? (
          <span className={cn(
            "ml-auto shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide",
            badge.color,
          )}>
            {badge.label}
          </span>
        ) : null}
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onClick={() => {
              onStartEditing();
            }}
          >
            <PencilIcon className="mr-2 size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              onDelete?.(session.id);
            }}
          >
            <TrashIcon className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
