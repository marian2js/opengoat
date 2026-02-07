import { stat } from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import type { OpenGoatService } from "@opengoat/core";
import type { WorkbenchMessage, WorkbenchProject, WorkbenchSession } from "@shared/workbench";
import { WorkbenchStore } from "./workbench-store";

interface WorkbenchServiceDeps {
  opengoat: OpenGoatService;
  store: WorkbenchStore;
}

export class WorkbenchService {
  private readonly opengoat: OpenGoatService;
  private readonly store: WorkbenchStore;

  public constructor(deps: WorkbenchServiceDeps) {
    this.opengoat = deps.opengoat;
    this.store = deps.store;
  }

  public async bootstrap(): Promise<{
    homeDir: string;
    projects: WorkbenchProject[];
  }> {
    await this.opengoat.initialize();
    return {
      homeDir: this.opengoat.getHomeDir(),
      projects: await this.store.listProjects()
    };
  }

  public listProjects(): Promise<WorkbenchProject[]> {
    return this.store.listProjects();
  }

  public async addProject(rawPath: string): Promise<WorkbenchProject> {
    const normalized = path.resolve(rawPath.trim());
    await assertDirectory(normalized);
    return this.store.addProject(normalized);
  }

  public async pickAndAddProject(): Promise<WorkbenchProject | null> {
    const selection = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select a project folder"
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    const first = selection.filePaths[0];
    if (!first) {
      return null;
    }

    return this.addProject(first);
  }

  public async createSession(projectId: string, title?: string): Promise<WorkbenchSession> {
    const sessionTitle = normalizeSessionTitle(title);
    return this.store.createSession(projectId, sessionTitle);
  }

  public listSessions(projectId: string): Promise<WorkbenchSession[]> {
    return this.store.listSessions(projectId);
  }

  public listMessages(projectId: string, sessionId: string): Promise<WorkbenchMessage[]> {
    return this.store.listMessages(projectId, sessionId);
  }

  public async sendMessage(params: {
    projectId: string;
    sessionId: string;
    message: string;
  }): Promise<{
    reply: WorkbenchMessage;
    tracePath?: string;
    providerId: string;
  }> {
    const message = params.message.trim();
    if (!message) {
      throw new Error("Message cannot be empty.");
    }

    const project = await this.store.getProject(params.projectId);
    const session = await this.store.getSession(params.projectId, params.sessionId);

    await this.store.appendMessage(project.id, session.id, {
      role: "user",
      content: message
    });

    const run = await this.opengoat.runAgent("orchestrator", {
      message,
      sessionRef: session.sessionKey,
      cwd: project.rootPath
    });

    const assistantContent = (run.stdout || run.stderr || "No response was returned.").trim();
    const reply = await this.store.appendMessage(project.id, session.id, {
      role: "assistant",
      content: assistantContent,
      tracePath: run.tracePath,
      providerId: run.providerId
    });

    const latest = reply.messages[reply.messages.length - 1];
    if (!latest) {
      throw new Error("Assistant response could not be stored.");
    }

    return {
      reply: latest,
      tracePath: run.tracePath,
      providerId: run.providerId
    };
  }
}

async function assertDirectory(targetPath: string): Promise<void> {
  const metadata = await stat(targetPath);
  if (!metadata.isDirectory()) {
    throw new Error(`Not a directory: ${targetPath}`);
  }
}

function normalizeSessionTitle(input?: string): string {
  const value = input?.trim();
  if (!value) {
    return "New session";
  }
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 117)}...`;
}
