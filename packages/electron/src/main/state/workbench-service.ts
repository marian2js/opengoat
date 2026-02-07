import { stat } from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import {
  resolveGuidedAuth as resolveCliGuidedAuth,
  runGuidedAuth as runCliGuidedAuth
} from "@cli/onboard-guided-auth";
import {
  DEFAULT_AGENT_ID,
  buildProviderFamilies,
  loadDotEnv,
  selectProvidersForOnboarding,
  type OpenGoatService
} from "@opengoat/core";
import type {
  WorkbenchBootstrap,
  WorkbenchGuidedAuthResult,
  WorkbenchMessage,
  WorkbenchOnboarding,
  WorkbenchProject,
  WorkbenchSession
} from "@shared/workbench";
import { WorkbenchStore } from "./workbench-store";

interface WorkbenchServiceDeps {
  opengoat: OpenGoatService;
  store: WorkbenchStore;
  loadDotEnvFn?: typeof loadDotEnv;
  resolveGuidedAuthFn?: typeof resolveCliGuidedAuth;
  runGuidedAuthFn?: typeof runCliGuidedAuth;
}

export class WorkbenchService {
  private readonly opengoat: OpenGoatService;
  private readonly store: WorkbenchStore;
  private readonly loadDotEnvFn: typeof loadDotEnv;
  private readonly resolveGuidedAuthFn: typeof resolveCliGuidedAuth;
  private readonly runGuidedAuthFn: typeof runCliGuidedAuth;

  public constructor(deps: WorkbenchServiceDeps) {
    this.opengoat = deps.opengoat;
    this.store = deps.store;
    this.loadDotEnvFn = deps.loadDotEnvFn ?? loadDotEnv;
    this.resolveGuidedAuthFn = deps.resolveGuidedAuthFn ?? resolveCliGuidedAuth;
    this.runGuidedAuthFn = deps.runGuidedAuthFn ?? runCliGuidedAuth;
  }

  public async bootstrap(): Promise<WorkbenchBootstrap> {
    await this.opengoat.initialize();
    return {
      homeDir: this.opengoat.getHomeDir(),
      projects: await this.store.listProjects(),
      onboarding: await this.getOnboardingState()
    };
  }

  public async getOnboardingState(): Promise<WorkbenchOnboarding> {
    const activeProvider = await this.opengoat.getAgentProvider(DEFAULT_AGENT_ID);
    const allProviders = await this.opengoat.listProviders();
    const providers = selectProvidersForOnboarding(DEFAULT_AGENT_ID, allProviders);
    const families = buildProviderFamilies(providers);
    const withOnboarding = await Promise.all(
      providers.map(async (provider) => {
        const onboarding = await this.opengoat.getProviderOnboarding(provider.id);
        const guidedAuth = this.resolveGuidedAuthFn(provider.id);
        const config = await this.opengoat.getProviderConfig(provider.id);
        const envFields = onboarding?.env ?? [];
        const configuredEnv = config?.env ?? {};
        const configuredEnvKeys = Object.keys(configuredEnv).sort((left, right) =>
          left.localeCompare(right)
        );
        const nonSecretKeys = new Set(
          envFields.filter((entry) => entry.secret !== true).map((entry) => entry.key)
        );
        const configuredEnvValues = Object.fromEntries(
          Object.entries(configuredEnv)
            .filter(([key, value]) => nonSecretKeys.has(key) && Boolean(value?.trim()))
            .map(([key, value]) => [key, value.trim()])
        );
        const missingRequiredEnv = envFields
          .filter((entry) => entry.required)
          .map((entry) => entry.key)
          .filter((key) => !(configuredEnv[key]?.trim()));

        return {
          id: provider.id,
          displayName: provider.displayName,
          kind: provider.kind,
          guidedAuth: guidedAuth
            ? {
                title: guidedAuth.title,
                description: guidedAuth.description
              }
            : undefined,
          envFields,
          configuredEnvKeys,
          configuredEnvValues,
          missingRequiredEnv,
          hasConfig: config !== null
        };
      })
    );

    const active = withOnboarding.find((provider) => provider.id === activeProvider.providerId);
    const needsOnboarding = !active || !active.hasConfig || active.missingRequiredEnv.length > 0;

    return {
      activeProviderId: activeProvider.providerId,
      needsOnboarding,
      families,
      providers: withOnboarding
    };
  }

  public async submitOnboarding(input: {
    providerId: string;
    env: Record<string, string>;
  }): Promise<WorkbenchOnboarding> {
    await this.opengoat.setProviderConfig(input.providerId, input.env);
    await this.opengoat.setAgentProvider(DEFAULT_AGENT_ID, input.providerId);
    return this.getOnboardingState();
  }

  public async runOnboardingGuidedAuth(input: {
    providerId: string;
  }): Promise<WorkbenchGuidedAuthResult> {
    const providerId = input.providerId.trim().toLowerCase();
    const guidedAuth = this.resolveGuidedAuthFn(providerId);
    if (!guidedAuth) {
      throw new Error(`Guided auth is not available for provider "${providerId}".`);
    }

    const notes: string[] = [];
    const result = await this.runGuidedAuthFn(providerId, {
      prompter: createDesktopGuidedAuthPrompter(notes)
    });

    return {
      providerId,
      env: result.env,
      note: result.note,
      notes
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
      cwd: project.rootPath,
      env: await this.buildInvocationEnv(project.rootPath)
    });
    if (run.code !== 0) {
      const details = (run.stderr || run.stdout || "No provider error details were returned.").trim();
      throw new Error(
        `Orchestrator provider failed (${run.providerId}, code ${run.code}). ${details}`
      );
    }

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

  private async buildInvocationEnv(projectRootPath: string): Promise<NodeJS.ProcessEnv> {
    const env: NodeJS.ProcessEnv = { ...process.env };

    for (const cwd of collectDotEnvDirectories(projectRootPath)) {
      await this.loadDotEnvFn({ cwd, env });
    }

    return env;
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

function collectDotEnvDirectories(projectRootPath: string): string[] {
  const cwd = process.cwd();
  const candidates = [
    projectRootPath,
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "../..")
  ];
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    resolved.push(normalized);
  }

  return resolved;
}

function createDesktopGuidedAuthPrompter(notes: string[]): {
  intro: (message: string) => Promise<void>;
  outro: (message: string) => Promise<void>;
  note: (message: string, title?: string) => Promise<void>;
  select: <T>(message: string, options: Array<{ value: T; label: string; hint?: string }>, initialValue?: T) => Promise<T>;
  text: (options: {
    message: string;
    initialValue?: string;
    placeholder?: string;
    required?: boolean;
    secret?: boolean;
  }) => Promise<string>;
  confirm: (options: { message: string; initialValue?: boolean }) => Promise<boolean>;
  progress: (initialMessage: string) => { update: (message: string) => void; stop: (message?: string) => void };
} {
  return {
    async intro(message: string): Promise<void> {
      notes.push(message);
    },
    async outro(message: string): Promise<void> {
      notes.push(message);
    },
    async note(message: string, title?: string): Promise<void> {
      notes.push(title ? `${title}: ${message}` : message);
    },
    async select<T>(
      message: string,
      options: Array<{ value: T; label: string; hint?: string }>,
      initialValue?: T
    ): Promise<T> {
      const selected = initialValue ?? options[0]?.value;
      if (selected === undefined) {
        throw new Error(`Guided auth could not auto-select an option for: ${message}`);
      }
      return selected;
    },
    async text(options: {
      message: string;
      initialValue?: string;
      placeholder?: string;
      required?: boolean;
      secret?: boolean;
    }): Promise<string> {
      const value = options.initialValue?.trim();
      if (value) {
        return value;
      }
      if (options.required) {
        throw new Error(
          `Guided auth requires manual input for "${options.message}". ` +
            "Use CLI onboarding for this provider or configure env vars first."
        );
      }
      return "";
    },
    async confirm(options: { message: string; initialValue?: boolean }): Promise<boolean> {
      return options.initialValue ?? true;
    },
    progress(initialMessage: string): { update: (message: string) => void; stop: (message?: string) => void } {
      notes.push(initialMessage);
      return {
        update(message: string): void {
          notes.push(message);
        },
        stop(message?: string): void {
          if (message) {
            notes.push(message);
          }
        }
      };
    }
  };
}
