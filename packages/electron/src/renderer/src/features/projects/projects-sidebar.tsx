import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Suggestion, Suggestions } from "@renderer/components/ai-elements/suggestion";
import type { WorkbenchProject } from "@shared/workbench";
import {
  FolderPlus,
  FolderTree,
  MessageSquare,
  Plus,
  TerminalSquare
} from "lucide-react";

interface ProjectsSidebarProps {
  projects: WorkbenchProject[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  manualPath: string;
  busy: boolean;
  onManualPathChange: (value: string) => void;
  onAddProjectDialog: () => void;
  onAddProjectPath: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateSession: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export function ProjectsSidebar(props: ProjectsSidebarProps) {
  const activeProject = props.projects.find((project) => project.id === props.activeProjectId) ?? null;

  return (
    <aside className="border-border/60 border-r bg-background/55 backdrop-blur-xl">
      <div className="flex h-full flex-col gap-4 p-4">
        <header className="rounded-xl border border-border/70 bg-card/55 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-heading text-lg font-semibold tracking-tight">OpenGoat</p>
              <p className="text-muted-foreground text-xs">Workspace + Sessions</p>
            </div>
            <TerminalSquare className="size-5 text-primary" />
          </div>
        </header>

        <section className="space-y-2 rounded-xl border border-border/70 bg-card/55 p-3">
          <Button className="w-full justify-start" disabled={props.busy} onClick={props.onAddProjectDialog}>
            <FolderPlus className="size-4" />
            Add Project
          </Button>
          <div className="flex gap-2">
            <Input
              value={props.manualPath}
              onChange={(event) => props.onManualPathChange(event.target.value)}
              placeholder="/path/to/project"
            />
            <Button
              variant="secondary"
              onClick={props.onAddProjectPath}
              disabled={props.busy || !props.manualPath.trim()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <Suggestions className="pt-1">
            <Suggestion suggestion="Pick Folder" onClick={props.onAddProjectDialog} />
            <Suggestion
              suggestion="New Session"
              disabled={!activeProject || props.busy}
              onClick={() => {
                if (activeProject) {
                  props.onCreateSession(activeProject.id);
                }
              }}
            />
          </Suggestions>
        </section>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {props.projects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/35 p-5 text-center">
              <FolderTree className="mb-2 size-5 text-muted-foreground" />
              <p className="text-sm">No projects yet.</p>
              <p className="text-muted-foreground text-xs">Add your first workspace to begin.</p>
            </div>
          ) : (
            props.projects.map((project) => {
              const isActiveProject = project.id === props.activeProjectId;
              return (
                <section
                  key={project.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    isActiveProject
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/70 bg-card/45 hover:bg-card/65"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => props.onSelectProject(project.id)}
                  >
                    <p className="truncate text-sm font-semibold">{project.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{project.rootPath}</p>
                  </button>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
                      Sessions
                    </p>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => props.onCreateSession(project.id)}
                      disabled={props.busy}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  <div className="mt-2 space-y-1">
                    {project.sessions.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No sessions yet.</p>
                    ) : (
                      project.sessions.map((session) => {
                        const isActiveSession =
                          props.activeProjectId === project.id &&
                          props.activeSessionId === session.id;
                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => props.onSelectSession(project.id, session.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                              isActiveSession
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/85 hover:bg-accent/65 hover:text-accent-foreground"
                            }`}
                          >
                            <MessageSquare className="size-3.5" />
                            <span className="truncate">{session.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
