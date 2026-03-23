import type { AgentCatalog, AgentSession } from "@opengoat/contracts";
import {
  BrainIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  TrashIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  brainNavigation,
  primaryNavigation,
  secondaryNavigation,
} from "@/app/config/navigation";
import {
  resolveDomain as sharedResolveDomain,
  buildFaviconSources as sharedBuildFaviconSources,
} from "@/lib/utils/favicon";
import { groupSessionsByDate } from "@/lib/utils/group-sessions-by-date";
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


interface AppSidebarProps {
  activeAgentId?: string | undefined;
  activeBrainSection?: string | undefined;
  activeSessionId?: string | undefined;
  activeView: "dashboard" | "connections" | "chat" | "brain" | "agents" | "settings" | "board";
  agentCatalog: AgentCatalog | null;
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
  onAddProject,
  onNewChat,
  onProjectSwitch,
  onSessionDelete,
  onSessionRename,
  onSessionSelect,
  sessions,
}: AppSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const allSessions = sessions ?? [];
  const sessionGroups = useMemo(
    () => groupSessionsByDate(allSessions),
    [allSessions],
  );
  const deEmphasizedIds = useMemo(
    () => getDeEmphasizedSessionIds(allSessions),
    [allSessions],
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

        {activeView === "chat" && sessionGroups.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            {onNewChat ? (
              <SidebarGroupAction title="New chat" onClick={onNewChat}>
                <PlusIcon />
                <span className="sr-only">New chat</span>
              </SidebarGroupAction>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {sessionGroups.map((group) => (
                  <li key={group.label} role="none">
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
                        {group.label}
                      </span>
                    </div>
                    <ul role="group" className="flex flex-col">
                      {group.sessions.map((session) => (
                        <SessionItem
                          key={session.id}
                          deEmphasized={deEmphasizedIds.has(session.id)}
                          isActive={session.id === activeSessionId}
                          isEditing={editingSessionId === session.id}
                          session={session}
                          onDelete={onSessionDelete}
                          onRename={onSessionRename}
                          onSelect={onSessionSelect}
                          onStartEditing={() => setEditingSessionId(session.id)}
                          onStopEditing={() => setEditingSessionId(null)}
                        />
                      ))}
                    </ul>
                  </li>
                ))}
              </SidebarMenu>
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
// Session item
// ---------------------------------------------------------------------------

function SessionItem({
  deEmphasized,
  isActive,
  isEditing,
  session,
  onDelete,
  onRename,
  onSelect,
  onStartEditing,
  onStopEditing,
}: {
  deEmphasized: boolean;
  isActive: boolean;
  isEditing: boolean;
  session: AgentSession;
  onDelete?: ((sessionId: string) => void) | undefined;
  onRename?: ((sessionId: string, label: string) => void) | undefined;
  onSelect?: ((sessionId: string) => void) | undefined;
  onStartEditing: () => void;
  onStopEditing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = formatSessionLabel(session);
  const unnamed = isUnnamedSession(session.label);

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
          <MessageSquareIcon className="size-4 shrink-0 text-sidebar-foreground/70" />
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
          deEmphasized && !isActive && "opacity-45",
          unnamed && !isActive && "text-sidebar-foreground/50",
        )}
      >
        <MessageSquareIcon />
        <span className={cn("truncate", unnamed ? "italic" : "font-medium")}>{label}</span>
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
