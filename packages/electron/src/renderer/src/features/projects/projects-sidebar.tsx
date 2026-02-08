import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ai-elements/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ai-elements/dropdown-menu";
import {
  Suggestion,
  Suggestions,
} from "@renderer/components/ai-elements/suggestion";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import type { WorkbenchProject } from "@shared/workbench";
import {
  FolderPlus,
  FolderTree,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

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
  onRenameSession: (
    projectId: string,
    sessionId: string,
    title: string,
  ) => void;
  onRemoveSession: (projectId: string, sessionId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
}

export function ProjectsSidebar(props: ProjectsSidebarProps) {
  const activeProject =
    props.projects.find((project) => project.id === props.activeProjectId) ??
    null;
  const [renameDialog, setRenameDialog] = useState<{
    projectId: string;
    sessionId: string;
    originalTitle: string;
    nextTitle: string;
  } | null>(null);

  const handleRenameSubmit = () => {
    const payload = renameDialog;
    if (!payload) {
      return;
    }

    const normalized = payload.nextTitle.trim();
    if (!normalized || normalized === payload.originalTitle.trim()) {
      setRenameDialog(null);
      return;
    }

    props.onRenameSession(payload.projectId, payload.sessionId, normalized);
    setRenameDialog(null);
  };

  return (
    <aside className="border-border/45 border-b glass-strong md:border-r md:border-b-0">
      {/* macOS titlebar drag region - allows window dragging from sidebar top */}
      <div className="titlebar-drag-region h-[52px] shrink-0" />
      <div className="flex h-[calc(100%-52px)] flex-col gap-3 p-3 pt-0 md:gap-4 md:p-4 md:pt-0">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="group relative overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(220_42%_12%_/_0.9),hsl(222_40%_9%_/_0.85))] px-4 py-4 shadow-[0_14px_36px_hsl(224_72%_2%_/_0.35)]"
        >
          {/* Animated gradient border */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-[-1px] rounded-2xl bg-[linear-gradient(135deg,hsl(162_78%_49%_/_0.3),hsl(194_86%_54%_/_0.2),hsl(162_78%_49%_/_0.1))]" />
          </div>
          <div className="relative flex items-center justify-between gap-2">
            <div>
              <p className="font-heading text-[1.15rem] font-bold tracking-tight text-gradient-animated">
                OpenGoat
              </p>
              <p className="text-muted-foreground text-xs">
                Workspace + Sessions
              </p>
            </div>
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="grid size-9 place-items-center rounded-xl border border-primary/40 bg-[linear-gradient(135deg,hsl(162_78%_49%_/_0.18),hsl(194_86%_54%_/_0.12))] shadow-[0_0_20px_hsl(162_78%_49%_/_0.15)]"
            >
              <Sparkles className="size-4 text-primary" />
            </motion.div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-2 rounded-2xl border border-border/70 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] p-3 shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04)]"
        >
          <Button
            className="btn-glow w-full justify-start gap-2"
            disabled={props.busy}
            onClick={props.onAddProjectDialog}
          >
            <FolderPlus className="size-4" />
            Add Project
          </Button>
          <div className="flex gap-2">
            <Input
              className="input-glow"
              value={props.manualPath}
              onChange={(event) => props.onManualPathChange(event.target.value)}
              placeholder="/path/to/project"
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="secondary"
                onClick={props.onAddProjectPath}
                disabled={props.busy || !props.manualPath.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </motion.div>
          </div>
          <Suggestions className="pt-1">
            <Suggestion
              suggestion="Pick Folder"
              onClick={props.onAddProjectDialog}
            />
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
        </motion.section>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {props.projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/65 bg-[color-mix(in_oklab,var(--surface)_80%,transparent)] p-6 text-center"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <FolderTree className="mb-3 size-8 text-primary/60" />
              </motion.div>
              <p className="text-sm font-medium">No projects yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Add your first workspace to begin
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {props.projects.map((project, index) => {
                const isActiveProject = project.id === props.activeProjectId;
                return (
                  <motion.section
                    key={project.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    layout
                    className={`card-lift rounded-2xl border p-3 ${
                      isActiveProject
                        ? "border-primary/65 bg-[linear-gradient(180deg,hsl(162_78%_14%_/_0.52),hsl(220_39%_11%_/_0.62))] shadow-[0_16px_36px_hsl(162_68%_10%_/_0.3),0_0_0_1px_hsl(162_78%_49%_/_0.2)]"
                        : "border-border/70 bg-[color-mix(in_oklab,var(--surface)_84%,transparent)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => props.onSelectProject(project.id)}
                    >
                      <p className="truncate text-[0.98rem] font-semibold">
                        {project.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {project.rootPath}
                      </p>
                    </button>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.18em]">
                        Sessions
                      </p>
                      <motion.div
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => props.onCreateSession(project.id)}
                          disabled={props.busy}
                          className="hover:bg-primary/15 hover:text-primary"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </motion.div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {project.sessions.length === 0 ? (
                        <p className="text-muted-foreground/70 py-1 text-xs italic">
                          No sessions yet
                        </p>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {project.sessions.map((session, sessionIndex) => {
                            const isActiveSession =
                              props.activeProjectId === project.id &&
                              props.activeSessionId === session.id;
                            return (
                              <motion.div
                                key={session.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{
                                  duration: 0.2,
                                  delay: sessionIndex * 0.03,
                                }}
                                layout
                                className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 transition-all duration-200 ${
                                  isActiveSession
                                    ? "bg-[linear-gradient(135deg,hsl(162_79%_50%),hsl(161_74%_42%))] text-primary-foreground shadow-[0_8px_20px_hsl(161_80%_27%_/_0.4),0_0_0_1px_hsl(162_78%_49%_/_0.3)]"
                                    : "text-foreground/85 hover:bg-[linear-gradient(135deg,hsl(162_78%_49%_/_0.12),hsl(194_86%_54%_/_0.08))] hover:text-foreground"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    props.onSelectSession(
                                      project.id,
                                      session.id,
                                    )
                                  }
                                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm"
                                >
                                  <MessageSquare
                                    className={`size-3.5 transition-transform duration-200 ${
                                      isActiveSession
                                        ? ""
                                        : "group-hover:scale-110"
                                    }`}
                                  />
                                  <span className="truncate">
                                    {session.title}
                                  </span>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                    >
                                      <MoreHorizontal className="size-3.5" />
                                      <span className="sr-only">
                                        Session actions
                                      </span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setRenameDialog({
                                          projectId: project.id,
                                          sessionId: session.id,
                                          originalTitle: session.title,
                                          nextTitle: session.title,
                                        });
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => {
                                        const confirmed = window.confirm(
                                          `Remove session "${session.title}"?`,
                                        );
                                        if (confirmed) {
                                          props.onRemoveSession(
                                            project.id,
                                            session.id,
                                          );
                                        }
                                      }}
                                    >
                                      <Trash2 className="size-4" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                  </motion.section>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
      <Dialog
        open={renameDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameDialog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
            <DialogDescription>
              Choose a new title for this session.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameDialog?.nextTitle ?? ""}
            autoFocus
            maxLength={120}
            onChange={(event) => {
              const value = event.target.value;
              setRenameDialog((current) =>
                current
                  ? {
                      ...current,
                      nextTitle: value,
                    }
                  : null,
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleRenameSubmit();
              }
            }}
            placeholder="Session title"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialog(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!renameDialog?.nextTitle.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
