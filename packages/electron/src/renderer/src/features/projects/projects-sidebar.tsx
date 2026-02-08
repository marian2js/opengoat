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
  FolderOpen,
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
  showTrafficLightInset: boolean;
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
  onRenameSession: (projectId: string, sessionId: string, title: string) => void;
  onRemoveSession: (projectId: string, sessionId: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export function ProjectsSidebar(props: ProjectsSidebarProps) {
  const [renameTarget, setRenameTarget] = useState<
    | {
        kind: "project";
        projectId: string;
      }
    | {
        kind: "session";
        projectId: string;
        sessionId: string;
      }
    | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [openMenuSessionKey, setOpenMenuSessionKey] = useState<string | null>(null);

  const renameEntity = useMemo(
    () => {
      if (!renameTarget) {
        return null;
      }

      if (renameTarget.kind === "project") {
        const project =
          props.projects.find((candidate) => candidate.id === renameTarget.projectId) ?? null;
        return project
          ? {
              kind: "project" as const,
              projectId: project.id,
              value: project.name
            }
          : null;
      }

      const project =
        props.projects.find((candidate) => candidate.id === renameTarget.projectId) ?? null;
      const session =
        project?.sessions.find((candidate) => candidate.id === renameTarget.sessionId) ?? null;
      if (!project || !session) {
        return null;
      }

      return {
        kind: "session" as const,
        projectId: project.id,
        sessionId: session.id,
        value: session.title
      };
    },
    [props.projects, renameTarget]
  );

  const onOpenRenameDialog = (project: WorkbenchProject) => {
    setRenameTarget({
      kind: "project",
      projectId: project.id
    });
    setRenameValue(project.name);
  };

  const onOpenRenameSessionDialog = (
    projectId: string,
    sessionId: string,
    title: string
  ) => {
    setRenameTarget({
      kind: "session",
      projectId,
      sessionId
    });
    setRenameValue(title);
  };

  const onCloseRenameDialog = () => {
    setRenameTarget(null);
    setRenameValue("");
  };

  const onSubmitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameEntity) {
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName || nextName === renameEntity.value) {
      onCloseRenameDialog();
      return;
    }

    if (renameEntity.kind === "project") {
      props.onRenameProject(renameEntity.projectId, nextName);
    } else {
      props.onRenameSession(renameEntity.projectId, renameEntity.sessionId, nextName);
    }
    onCloseRenameDialog();
  };

  const canCreateSessionFromHeader = Boolean(props.activeProjectId) && !props.busy;

  return (
    <>
      <aside className="border-border/70 flex min-h-0 flex-col border-r bg-[hsl(224_16%_7%)]">
        <div className="titlebar-drag-region flex h-11 items-center px-2">
          {props.showTrafficLightInset ? (
            <div className="h-full w-[76px] shrink-0" />
          ) : null}
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
            disabled={!canCreateSessionFromHeader}
            onClick={() => {
              if (!props.activeProjectId) {
                return;
              }
              props.onCreateSession(props.activeProjectId);
            }}
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
                    {selected ? (
                      <FolderOpen className="size-4" />
                    ) : (
                      <Folder className="size-4" />
                    )}
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
                          {projectSelected ? (
                            <FolderOpen className="size-4 shrink-0" />
                          ) : (
                            <Folder className="size-4 shrink-0" />
                          )}
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
                              const sessionMenuKey = `${project.id}:${session.id}`;
                              const showSessionActions = openMenuSessionKey === sessionMenuKey;
                              return (
                                <div key={session.id} className="group/session relative">
                                  <button
                                    type="button"
                                    className={`hover:bg-muted w-full rounded-md px-2 py-1 pr-10 text-left text-sm ${selected ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                                    onClick={() => props.onSelectSession(project.id, session.id)}
                                  >
                                    <span className="truncate">{session.title}</span>
                                  </button>
                                  <div
                                    className={`absolute top-1/2 right-0.5 flex -translate-y-1/2 items-center transition-opacity group-hover/session:opacity-100 group-focus-within/session:opacity-100 ${showSessionActions ? "opacity-100" : "opacity-0"}`}
                                  >
                                    <DropdownMenu
                                      open={openMenuSessionKey === sessionMenuKey}
                                      onOpenChange={(open) => {
                                        setOpenMenuSessionKey(open ? sessionMenuKey : null);
                                      }}
                                    >
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-xs"
                                          className="text-muted-foreground hover:text-foreground"
                                          aria-label={`${session.title} settings`}
                                          title="Session settings"
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          <MoreHorizontal className="size-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          disabled={props.busy}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            onOpenRenameSessionDialog(
                                              project.id,
                                              session.id,
                                              session.title
                                            );
                                          }}
                                        >
                                          <PencilLine className="size-4" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          disabled={props.busy}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            if (
                                              window.confirm(
                                                `Delete session "${session.title}"?`
                                              )
                                            ) {
                                              props.onRemoveSession(project.id, session.id);
                                            }
                                          }}
                                        >
                                          <Trash2 className="size-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
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
        open={Boolean(renameEntity)}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRenameDialog();
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <form onSubmit={onSubmitRename} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {renameEntity?.kind === "session" ? "Rename Session" : "Rename Project"}
              </DialogTitle>
              <DialogDescription>
                {renameEntity?.kind === "session"
                  ? "Choose a new name for this session."
                  : "Choose a new name for this project."}
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder={renameEntity?.kind === "session" ? "Session name" : "Project name"}
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
