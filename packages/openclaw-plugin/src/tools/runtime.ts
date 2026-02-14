type OpenGoatCoreModule = typeof import("../../../core/src/index.js");
type OpenGoatService = OpenGoatCoreModule["OpenGoatService"];

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
  const coreModule = await loadOpenGoatCoreModule();
  const runtime = coreModule.createOpenGoatRuntime({
    logLevel: "silent",
  });
  await runtime.service.initialize();
  return runtime.service;
}

async function loadOpenGoatCoreModule(): Promise<OpenGoatCoreModule> {
  try {
    return (await import("@opengoat/core")) as OpenGoatCoreModule;
  } catch {
    try {
      return await import("../../../core/src/index.js");
    } catch (error) {
      throw new Error(
        `Unable to load OpenGoat core runtime for OpenClaw plugin tools: ${toErrorMessage(
          error,
        )}`,
      );
    }
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
