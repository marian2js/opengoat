type OpenGoatCoreExports = typeof import("../../../core/src/index.js");
type OpenGoatService = OpenGoatCoreExports["OpenGoatService"];
type CreateOpenGoatRuntime = OpenGoatCoreExports["createOpenGoatRuntime"];

interface OpenGoatCoreRuntimeModule {
  createOpenGoatRuntime: CreateOpenGoatRuntime;
}

interface CoreModuleLoadAttempt {
  label: string;
  load: () => Promise<unknown>;
}

const CORE_MODULE_LOAD_ATTEMPTS: readonly CoreModuleLoadAttempt[] = [
  {
    label: "bundled-local-core-src",
    load: () => import("../../../core/src/index.js"),
  },
  {
    label: "bundled-local-core-dist",
    load: () => import("../../../core/dist/index.js"),
  },
  {
    label: "monorepo-dist-plugin-core-src",
    load: () => import("../../../../../../core/src/index.js"),
  },
  {
    label: "monorepo-dist-plugin-core-dist",
    load: () => import("../../../../../../core/dist/index.js"),
  },
  {
    label: "@opengoat/core",
    load: () => import("@opengoat/core"),
  },
];

export interface OpenGoatToolsRuntime {
  getService(): Promise<OpenGoatService>;
}

export function createOpenGoatToolsRuntime(): OpenGoatToolsRuntime {
  let servicePromise: Promise<OpenGoatService> | undefined;

  return {
    async getService(): Promise<OpenGoatService> {
      if (!servicePromise) {
        servicePromise = initializeOpenGoatService();
      }
      return servicePromise;
    },
  };
}

async function initializeOpenGoatService(): Promise<OpenGoatService> {
  const coreModule = await loadOpenGoatCoreRuntimeModule();
  const runtime = coreModule.createOpenGoatRuntime({
    logLevel: "silent",
  });
  await runtime.service.initialize();
  return runtime.service;
}

async function loadOpenGoatCoreRuntimeModule(): Promise<OpenGoatCoreRuntimeModule> {
  const failures: string[] = [];

  for (const attempt of CORE_MODULE_LOAD_ATTEMPTS) {
    try {
      const candidate = await attempt.load();
      const createOpenGoatRuntime = resolveCreateOpenGoatRuntime(candidate);

      if (typeof createOpenGoatRuntime === "function") {
        return { createOpenGoatRuntime };
      }

      failures.push(
        `${attempt.label}: missing createOpenGoatRuntime export (keys: ${describeModuleKeys(
          candidate,
        )})`,
      );
    } catch (error) {
      failures.push(`${attempt.label}: ${toErrorMessage(error)}`);
    }
  }

  throw new Error(
    `Unable to load OpenGoat core runtime for OpenClaw plugin tools: ${failures.join(" | ")}`,
  );
}

export function resolveCreateOpenGoatRuntime(
  moduleCandidate: unknown,
): CreateOpenGoatRuntime | undefined {
  const candidate = asRecord(moduleCandidate);
  const direct = candidate.createOpenGoatRuntime;
  if (typeof direct === "function") {
    return direct as CreateOpenGoatRuntime;
  }

  const defaultExport = asRecord(candidate.default);
  const nested = defaultExport.createOpenGoatRuntime;
  if (typeof nested === "function") {
    return nested as CreateOpenGoatRuntime;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function describeModuleKeys(moduleCandidate: unknown): string {
  const keys = Object.keys(asRecord(moduleCandidate));
  if (keys.length === 0) {
    return "<none>";
  }
  return keys.slice(0, 12).join(", ");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
