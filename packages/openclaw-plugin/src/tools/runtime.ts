import { createOpenGoatRuntime, type OpenGoatService } from "../../../core/src/index.js";

export interface OpenGoatToolsRuntime {
  getService(): Promise<OpenGoatService>;
}

export function createOpenGoatToolsRuntime(): OpenGoatToolsRuntime {
  const runtime = createOpenGoatRuntime({
    logLevel: "silent",
  });

  let readyPromise: Promise<void> | undefined;

  return {
    async getService(): Promise<OpenGoatService> {
      if (!readyPromise) {
        readyPromise = runtime.service.initialize().then(() => undefined);
      }
      await readyPromise;
      return runtime.service;
    },
  };
}
