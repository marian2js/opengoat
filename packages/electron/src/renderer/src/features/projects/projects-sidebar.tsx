import { Button } from "@renderer/components/ui/button";
import type { WorkbenchProject } from "@shared/workbench";
import type { ReactNode } from "react";
import {
  Folder,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Users
} from "lucide-react";

interface ProjectsSidebarProps {
  projects: WorkbenchProject[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  busy: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAddProjectDialog: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export function ProjectsSidebar(props: ProjectsSidebarProps) {
  return (
    <aside className="border-border/70 flex min-h-0 flex-col border-r bg-[hsl(224_16%_7%)]">
      <div className="titlebar-drag-region flex h-11 items-center px-2">
        <button
          type="button"
          className="titlebar-no-drag text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md"
          onClick={props.onToggleCollapsed}
          aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {props.collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <div className="space-y-1 px-2 pb-3">
        <SidebarAction
          icon={<FolderPlus className="size-4" />}
          label="Add project"
          collapsed={props.collapsed}
          disabled={props.busy}
          onClick={props.onAddProjectDialog}
        />
        <SidebarAction
          icon={<Plus className="size-4" />}
          label="New session"
          collapsed={props.collapsed}
          disabled
        />
        <SidebarAction
          icon={<Users className="size-4" />}
          label="Agents"
          collapsed={props.collapsed}
          disabled
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {props.collapsed ? (
          <div className="space-y-1">
            {props.projects.map((project) => {
              const selected = project.id === props.activeProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  title={project.name}
                  className={`text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md ${selected ? "bg-muted text-foreground" : ""}`}
                  onClick={() => props.onSelectProject(project.id)}
                >
                  <Folder className="size-4" />
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground px-1 pb-2 text-xs font-medium tracking-wide">
              Projects
            </p>
            <div className="space-y-3">
              {props.projects.map((project) => {
                const projectSelected = project.id === props.activeProjectId;
                return (
                  <section key={project.id} className="space-y-1">
                    <button
                      type="button"
                      className={`hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${projectSelected ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                      onClick={() => props.onSelectProject(project.id)}
                    >
                      <Folder className="size-4 shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </button>
                    <div className="pl-7">
                      {project.sessions.length === 0 ? (
                        <p className="text-muted-foreground text-xs">No sessions</p>
                      ) : (
                        <div className="space-y-0.5">
                          {project.sessions.map((session) => {
                            const selected =
                              project.id === props.activeProjectId &&
                              session.id === props.activeSessionId;
                            return (
                              <button
                                key={session.id}
                                type="button"
                                className={`hover:bg-muted w-full rounded-md px-2 py-1 text-left text-sm ${selected ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                                onClick={() => props.onSelectSession(project.id, session.id)}
                              >
                                <span className="truncate">{session.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarAction(props: {
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (props.collapsed) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        title={props.label}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.icon}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      className="justify-start gap-2 px-2 text-sm"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </Button>
  );
}
