import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveGatewayPackageRoot } from "../internal-gateway/package-paths.ts";

type AuthChoiceGroup = {
  hint?: string;
  label: string;
  options: Array<{
    hint?: string;
    label: string;
    value: string;
  }>;
  value: string;
};

type GatewayConfig = Record<string, unknown>;

type AuthChoiceOptionsModule = {
  buildAuthChoiceGroups(params: {
    config?: GatewayConfig;
    env?: NodeJS.ProcessEnv;
    includeSkip: boolean;
    store: {
      profiles: Record<string, unknown>;
      version: number;
    };
    workspaceDir?: string;
  }): {
    groups: AuthChoiceGroup[];
  };
};

type AuthChoiceModule = {
  applyAuthChoice(params: {
    agentDir?: string;
    authChoice: string;
    config: GatewayConfig;
    opts?: Record<string, unknown>;
    prompter: WizardPrompterLike;
    runtime: RuntimeEnvLike;
    setDefaultModel: boolean;
  }): Promise<{
    agentModelOverride?: string;
    config: GatewayConfig;
  }>;
  resolvePreferredProviderForAuthChoice(params: {
    choice: string;
    config?: GatewayConfig;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
  }): string | undefined;
};

export type RuntimeModelCatalogEntry = {
  contextWindow?: number;
  id: string;
  input?: string[];
  name: string;
  provider: string;
  reasoning?: boolean;
};

type ModelCatalogModule = {
  loadModelCatalog(params?: {
    config?: GatewayConfig;
    useCache?: boolean;
  }): Promise<RuntimeModelCatalogEntry[]>;
};

type ModelSelectionModule = {
  applyDefaultModelPrimaryUpdate(params: {
    cfg: GatewayConfig;
    field: "imageModel" | "model";
    modelRaw: string;
  }): GatewayConfig;
  applyModelAllowlist(cfg: GatewayConfig, models: string[]): GatewayConfig;
};

type ProviderWizardModule = {
  runProviderModelSelectedHook(params: {
    agentDir?: string;
    config: GatewayConfig;
    env?: NodeJS.ProcessEnv;
    model: string;
    prompter: WizardPrompterLike;
    workspaceDir?: string;
  }): Promise<void>;
};

export type WizardPrompterLike = {
  authLink?(params: {
    instructions?: string;
    label?: string;
    url: string;
  }): Promise<void>;
  confirm(params: {
    initialValue?: boolean;
    message: string;
  }): Promise<boolean>;
  intro(title: string): Promise<void>;
  multiselect<T>(params: {
    initialValues?: T[];
    message: string;
    options: Array<{ hint?: string; label: string; value: T }>;
    searchable?: boolean;
  }): Promise<T[]>;
  note(message: string, title?: string): Promise<void>;
  outro(message: string): Promise<void>;
  progress(label: string): {
    stop(message?: string): void;
    update(message: string): void;
  };
  select<T>(params: {
    initialValue?: T;
    message: string;
    options: Array<{ hint?: string; label: string; value: T }>;
  }): Promise<T>;
  text(params: {
    initialValue?: string;
    message: string;
    placeholder?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
};

export type RuntimeEnvLike = {
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
  log: (...args: unknown[]) => void;
};

let authChoiceModulePromise: Promise<AuthChoiceModule> | null = null;
let authChoiceOptionsModulePromise: Promise<AuthChoiceOptionsModule> | null = null;
let authProfileRuntimeModulePromise: Promise<AuthProfileRuntimeModule> | null = null;
let modelCatalogModulePromise: Promise<ModelCatalogModule> | null = null;
let modelSelectionModulePromise: Promise<ModelSelectionModule> | null = null;
let providerWizardModulePromise: Promise<ProviderWizardModule> | null = null;

type AuthProfileRuntimeModule = {
  applyAuthProfileConfig(params: Record<string, unknown>, options: {
    email?: string;
    mode: "api_key" | "oauth" | "token";
    preferProfileFirst?: boolean;
    profileId: string;
    provider: string;
  }): Record<string, unknown>;
  upsertAuthProfile(params: {
    agentDir?: string;
    credential: {
      email?: string;
      key?: string;
      provider: string;
      token?: string;
      type: "api_key" | "oauth" | "token";
    };
    profileId: string;
  }): void;
};

async function listDistModules(prefix: string): Promise<string[]> {
  const distDir = join(resolveGatewayPackageRoot(), "dist");
  const entries = (await readdir(distDir))
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".js"))
    .sort();

  return entries.map((entry) => pathToFileURL(join(distDir, entry)).href);
}

async function listModulesAt(pathWithinPackage: string): Promise<string[]> {
  const directory = join(resolveGatewayPackageRoot(), pathWithinPackage);
  const entries = (await readdir(directory))
    .filter((entry) => entry.endsWith(".js"))
    .sort();

  return entries.map((entry) => pathToFileURL(join(directory, entry)).href);
}

async function listRootDistModules(): Promise<string[]> {
  return await listModulesAt("dist");
}

async function loadNamedFunction<T extends (...args: never[]) => unknown>(params: {
  functionName: string;
  moduleUrls: string[];
  errorMessage: string;
}): Promise<T> {
  for (const moduleUrl of params.moduleUrls) {
    const module = (await import(moduleUrl)) as Record<string, unknown>;
    const implementation = Object.values(module).find(
      (value): value is T =>
        typeof value === "function" &&
        value.name === params.functionName,
    );

    if (implementation) {
      return implementation;
    }
  }

  throw new Error(params.errorMessage);
}

export async function loadAuthChoiceOptionsModule(): Promise<AuthChoiceOptionsModule> {
  authChoiceOptionsModulePromise ??= (async () => {
    const moduleUrls = await listDistModules("auth-choice-options-");
    for (const moduleUrl of moduleUrls) {
      const module = (await import(moduleUrl)) as Record<string, unknown>;
      const buildAuthChoiceGroups = Object.values(module).find(
        (value): value is AuthChoiceOptionsModule["buildAuthChoiceGroups"] =>
          typeof value === "function" && value.name === "buildAuthChoiceGroups",
      );

      if (buildAuthChoiceGroups) {
        return {
          buildAuthChoiceGroups,
        };
      }
    }

    throw new Error(
      "Embedded runtime auth-choice-options module is missing buildAuthChoiceGroups.",
    );
  })();

  return await authChoiceOptionsModulePromise;
}

export async function loadAuthChoiceModule(): Promise<AuthChoiceModule> {
  authChoiceModulePromise ??= (async () => {
    const moduleUrls = await listDistModules("auth-choice-");
    for (const moduleUrl of moduleUrls) {
      const module = (await import(moduleUrl)) as Record<string, unknown>;
      const directApplyAuthChoice = Object.values(module).find(
        (value): value is AuthChoiceModule["applyAuthChoice"] =>
          typeof value === "function" && value.name === "applyAuthChoice",
      );
      const exportsObject = Object.values(module).find(
        (value): value is {
          applyAuthChoice?: AuthChoiceModule["applyAuthChoice"];
          resolvePreferredProviderForAuthChoice?: AuthChoiceModule["resolvePreferredProviderForAuthChoice"];
        } =>
          value !== null &&
          typeof value === "object" &&
          "resolvePreferredProviderForAuthChoice" in value,
      );
      const resolvePreferredProviderForAuthChoice =
        exportsObject?.resolvePreferredProviderForAuthChoice ??
        Object.values(module).find(
          (value): value is AuthChoiceModule["resolvePreferredProviderForAuthChoice"] =>
            typeof value === "function" &&
            value.name === "resolvePreferredProviderForAuthChoice",
        );
      const applyAuthChoice =
        exportsObject?.applyAuthChoice ?? directApplyAuthChoice;

      if (applyAuthChoice && resolvePreferredProviderForAuthChoice) {
        return {
          applyAuthChoice,
          resolvePreferredProviderForAuthChoice,
        };
      }
    }

    throw new Error(
      "Embedded runtime auth-choice module is missing applyAuthChoice helpers.",
    );
  })();

  return await authChoiceModulePromise;
}

export async function loadModelCatalogModule(): Promise<ModelCatalogModule> {
  modelCatalogModulePromise ??= (async () => {
    const moduleUrls = await listModulesAt("dist/plugin-sdk");
    return {
      loadModelCatalog: await loadNamedFunction<ModelCatalogModule["loadModelCatalog"]>({
        errorMessage:
          "Embedded runtime model catalog module is missing loadModelCatalog.",
        functionName: "loadModelCatalog",
        moduleUrls,
      }),
    };
  })();

  return await modelCatalogModulePromise;
}

export async function loadAuthProfileRuntimeModule(): Promise<AuthProfileRuntimeModule> {
  authProfileRuntimeModulePromise ??= (async () => {
    const moduleUrls = await listRootDistModules();
    return {
      applyAuthProfileConfig: await loadNamedFunction<AuthProfileRuntimeModule["applyAuthProfileConfig"]>({
        errorMessage:
          "Embedded runtime auth profile module is missing applyAuthProfileConfig.",
        functionName: "applyAuthProfileConfig",
        moduleUrls,
      }),
      upsertAuthProfile: await loadNamedFunction<AuthProfileRuntimeModule["upsertAuthProfile"]>({
        errorMessage:
          "Embedded runtime auth profile module is missing upsertAuthProfile.",
        functionName: "upsertAuthProfile",
        moduleUrls,
      }),
    };
  })();

  return await authProfileRuntimeModulePromise;
}

export async function loadModelSelectionModule(): Promise<ModelSelectionModule> {
  modelSelectionModulePromise ??= (async () => {
    const helperModuleUrls = await listDistModules("provider-auth-helpers-");
    const moduleUrls = await listDistModules("model-picker-");
    return {
      applyDefaultModelPrimaryUpdate:
        await loadNamedFunction<ModelSelectionModule["applyDefaultModelPrimaryUpdate"]>({
          errorMessage:
            "Embedded runtime model selection module is missing applyDefaultModelPrimaryUpdate.",
          functionName: "applyDefaultModelPrimaryUpdate",
          moduleUrls: [...helperModuleUrls, ...moduleUrls],
        }),
      applyModelAllowlist:
        await loadNamedFunction<ModelSelectionModule["applyModelAllowlist"]>({
          errorMessage:
            "Embedded runtime model selection module is missing applyModelAllowlist.",
          functionName: "applyModelAllowlist",
          moduleUrls,
        }),
    };
  })();

  return await modelSelectionModulePromise;
}

export async function loadProviderWizardModule(): Promise<ProviderWizardModule> {
  providerWizardModulePromise ??= (async () => {
    const moduleUrls = await listDistModules("provider-wizard-");
    return {
      runProviderModelSelectedHook:
        await loadNamedFunction<ProviderWizardModule["runProviderModelSelectedHook"]>({
          errorMessage:
            "Embedded runtime provider wizard module is missing runProviderModelSelectedHook.",
          functionName: "runProviderModelSelectedHook",
          moduleUrls,
        }),
    };
  })();

  return await providerWizardModulePromise;
}
