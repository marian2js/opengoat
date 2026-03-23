import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const clientSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/lib/sidecar/client.ts",
  ),
  "utf-8",
);

const routesSrc = readFileSync(
  resolve(
    __dirname,
    "../../packages/sidecar/src/server/routes/playbooks.ts",
  ),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(
    __dirname,
    "../../packages/sidecar/src/server/app.ts",
  ),
  "utf-8",
);

const contextSrc = readFileSync(
  resolve(
    __dirname,
    "../../packages/sidecar/src/server/context.ts",
  ),
  "utf-8",
);

const indexSrc = readFileSync(
  resolve(
    __dirname,
    "../../packages/sidecar/src/index.ts",
  ),
  "utf-8",
);

const hookSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/hooks/usePlaybooks.ts",
  ),
  "utf-8",
);

describe("SidecarClient — Playbook methods", () => {
  it("has a listPlaybooks method", () => {
    expect(clientSrc).toContain("async listPlaybooks()");
  });

  it("has a getPlaybook method", () => {
    expect(clientSrc).toContain("async getPlaybook(playbookId: string)");
  });

  it("listPlaybooks uses listPlaybooksResponseSchema for parsing", () => {
    expect(clientSrc).toContain("listPlaybooksResponseSchema.parse");
  });

  it("getPlaybook uses playbookManifestSchema for parsing", () => {
    expect(clientSrc).toContain("playbookManifestSchema.parse");
  });

  it("listPlaybooks hits /playbooks endpoint", () => {
    expect(clientSrc).toContain('"/playbooks"');
  });
});

describe("Sidecar playbook routes", () => {
  it("exposes GET / route", () => {
    expect(routesSrc).toContain('app.get("/",');
  });

  it("exposes GET /:playbookId route", () => {
    expect(routesSrc).toContain('app.get("/:playbookId",');
  });

  it("calls playbookRegistryService.listPlaybooks", () => {
    expect(routesSrc).toContain("runtime.playbookRegistryService.listPlaybooks()");
  });

  it("calls playbookRegistryService.getPlaybook", () => {
    expect(routesSrc).toContain("runtime.playbookRegistryService.getPlaybook(playbookId)");
  });

  it("returns 404 for missing playbook", () => {
    expect(routesSrc).toContain("404");
  });
});

describe("Sidecar app — playbook route registration", () => {
  it("registers playbook routes in app.ts", () => {
    expect(appSrc).toContain("createPlaybookRoutes");
    expect(appSrc).toContain('"/playbooks"');
  });
});

describe("SidecarRuntime — playbookRegistryService field", () => {
  it("has playbookRegistryService in the interface", () => {
    expect(contextSrc).toContain("playbookRegistryService: PlaybookRegistryService");
  });

  it("imports PlaybookRegistryService from @opengoat/core", () => {
    expect(contextSrc).toContain("PlaybookRegistryService");
    expect(contextSrc).toContain("@opengoat/core");
  });
});

describe("Sidecar startup — service initialization", () => {
  it("creates PlaybookRegistryService with BUILTIN_PLAYBOOKS", () => {
    expect(indexSrc).toContain("PlaybookRegistryService");
    expect(indexSrc).toContain("BUILTIN_PLAYBOOKS");
  });

  it("passes playbookRegistryService into the runtime", () => {
    expect(indexSrc).toContain("playbookRegistryService");
  });
});

describe("usePlaybooks hook", () => {
  it("calls client.listPlaybooks", () => {
    expect(hookSrc).toContain("client.listPlaybooks()");
  });

  it("returns playbooks, isLoading, and error", () => {
    expect(hookSrc).toContain("playbooks");
    expect(hookSrc).toContain("isLoading");
    expect(hookSrc).toContain("error");
  });

  it("handles graceful fallback on error", () => {
    expect(hookSrc).toContain("setPlaybooks([])");
  });

  it("supports cancellation on unmount", () => {
    expect(hookSrc).toContain("cancelled");
  });
});
