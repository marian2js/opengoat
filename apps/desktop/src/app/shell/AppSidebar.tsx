import type { AgentCatalog, AgentSession } from "@opengoat/contracts";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  Wallet2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  primaryNavigation,
  secondaryNavigation,
} from "@/app/config/navigation";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import type { AuthOverview } from "@/app/types";

interface AppSidebarProps {
  activeAgentId?: string;
  activeSessionId?: string;
  activeView: "connections" | "chat" | "agents" | "settings";
  agentCatalog: AgentCatalog | null;
  authOverview: AuthOverview | null;
  onAddProject?: () => void;
  onNewChat?: () => void;
  onProjectSwitch?: (agentId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, label: string) => void;
  onSessionSelect?: (sessionId: string) => void;
  sessions?: AgentSession[];
}

function formatSessionLabel(session: AgentSession): string {
  return session.label ?? "Untitled chat";
}

export function AppSidebar({
  activeAgentId,
  activeSessionId,
  activeView,
  agentCatalog,
  authOverview,
  onAddProject,
  onNewChat,
  onProjectSwitch,
  onSessionDelete,
  onSessionRename,
  onSessionSelect,
  sessions,
}: AppSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
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
              <a href="#chat">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Wallet2Icon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="text-[13px] font-semibold tracking-tight">
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
              {primaryNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={
                      (item.href === "#connections" &&
                        activeView === "connections") ||
                      (item.href === "#chat" && activeView === "chat") ||
                      (item.href === "#agents" && activeView === "agents")
                    }
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

        {activeView === "chat" && sessions && sessions.length > 0 ? (
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
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={item.href === "#settings" && activeView === "settings"}
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

/**
 * Derive a display domain from an agent's description (project URL) or ID.
 * Returns the hostname without `www.` prefix.
 */
function resolveDomain(agent: { id: string; name: string; description?: string }): string {
  const rawUrl = agent.description?.trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return rawUrl;
    }
  }

  // Fallback: derive domain from agent ID (e.g. "bullaware-main" → "bullaware.com")
  const projectId = agent.id.replace(/-main$/, "");
  if (projectId && projectId !== agent.id) {
    return `${projectId}.com`;
  }

  return agent.name;
}

/**
 * Build an ordered list of favicon URLs to try for a given domain.
 * Each source is attempted in order; the component falls back on error.
 */
function buildFaviconSources(domain: string): string[] {
  const encoded = encodeURIComponent(domain);
  return [
    `https://${domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encoded}&sz=32`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
}

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
  isActive,
  isEditing,
  session,
  onDelete,
  onRename,
  onSelect,
  onStartEditing,
  onStopEditing,
}: {
  isActive: boolean;
  isEditing: boolean;
  session: AgentSession;
  onDelete?: (sessionId: string) => void;
  onRename?: (sessionId: string, label: string) => void;
  onSelect?: (sessionId: string) => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const label = formatSessionLabel(session);

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
      >
        <MessageSquareIcon />
        <span className="truncate">{label}</span>
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
