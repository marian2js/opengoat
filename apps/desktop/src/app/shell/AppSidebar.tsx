import type { AgentSession } from "@opengoat/contracts";
import {
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  Wallet2Icon,
  ZapIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  primaryNavigation,
  secondaryNavigation,
} from "@/app/config/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  activeSessionId?: string;
  activeView: "connections" | "chat" | "agents";
  authOverview: AuthOverview | null;
  onNewChat?: () => void;
  onSessionDelete?: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, label: string) => void;
  onSessionSelect?: (sessionId: string) => void;
  sessions?: AgentSession[];
}

function formatSessionLabel(session: AgentSession): string {
  return session.label ?? "Untitled chat";
}

export function AppSidebar({
  activeSessionId,
  activeView,
  authOverview,
  onNewChat,
  onSessionDelete,
  onSessionRename,
  onSessionSelect,
  sessions,
}: AppSidebarProps) {
  const connectedProviderCount = authOverview?.connections.length ?? 0;
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

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
                  <SidebarMenuButton asChild tooltip={item.title}>
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
        <div className="flex items-center gap-2.5 rounded-lg p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1">
          <Avatar className="size-7 rounded-md">
            <AvatarFallback className="rounded-md bg-primary/12 text-[10px] font-semibold text-primary">
              CF
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[12px] font-medium text-sidebar-foreground">
              Primary household
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/45">
              {connectedProviderCount > 0
                ? `${String(connectedProviderCount)} connected`
                : "Setup pending"}
            </p>
          </div>
          {connectedProviderCount > 0 ? (
            <div className="hidden text-success group-data-[collapsible=icon]:hidden lg:block">
              <ZapIcon className="size-3" />
            </div>
          ) : null}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

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
