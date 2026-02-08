import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@renderer/components/ai-elements/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ai-elements/dialog";
import type { WorkbenchProject } from "@shared/workbench";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  Folder,
  FolderPlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
  Trash2,
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
  onRenameProject: (projectId: string, name: string) => void;
  onRemoveProject: (projectId: string) => void;
  onCreateSession: (projectId: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export function ProjectsSidebar(props: ProjectsSidebarProps) {
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);

  const renameProject = useMemo(
    () =>
      renameProjectId
        ? props.projects.find((project) => project.id === renameProjectId) ?? null
        : null,
    [props.projects, renameProjectId]
  );

  const onOpenRenameDialog = (project: WorkbenchProject) => {
    setRenameProjectId(project.id);
    setRenameValue(project.name);
  };

  const onCloseRenameDialog = () => {
    setRenameProjectId(null);
    setRenameValue("");
  };

  const onSubmitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameProject) {
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName || nextName === renameProject.name) {
      onCloseRenameDialog();
      return;
    }

    props.onRenameProject(renameProject.id, nextName);
    onCloseRenameDialog();
  };

  return (
    <>
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
                  const isHomeProject = project.name === "Home";
                  const showActions = openMenuProjectId === project.id;
                  return (
                    <section key={project.id} className="space-y-1">
                      <div className="group/project relative">
                        <button
                          type="button"
                          className={`hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 pr-16 text-left text-sm ${projectSelected ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                          onClick={() => props.onSelectProject(project.id)}
                        >
                          <Folder className="size-4 shrink-0" />
                          <span className="truncate">{project.name}</span>
                        </button>
                        <div
                          className={`absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 transition-opacity group-hover/project:opacity-100 group-focus-within/project:opacity-100 ${showActions ? "opacity-100" : "opacity-0"}`}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Create session in ${project.name}`}
                            title="Create session"
                            disabled={props.busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              props.onCreateSession(project.id);
                            }}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                          <DropdownMenu
                            open={openMenuProjectId === project.id}
                            onOpenChange={(open) => {
                              setOpenMenuProjectId(open ? project.id : null);
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`${project.name} settings`}
                                title="Project settings"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={props.busy || isHomeProject}
                                onClick={(event) => {
                                  event.preventDefault();
                                  onOpenRenameDialog(project);
                                }}
                              >
                                <PencilLine className="size-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={props.busy || isHomeProject}
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (
                                    window.confirm(
                                      `Remove project "${project.name}" and all its sessions?`
                                    )
                                  ) {
                                    props.onRemoveProject(project.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
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

      <Dialog
        open={Boolean(renameProject)}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRenameDialog();
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <form onSubmit={onSubmitRename} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
              <DialogDescription>
                Choose a new name for this project.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Project name"
              maxLength={120}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onCloseRenameDialog}
                disabled={props.busy}
              >
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={props.busy}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
