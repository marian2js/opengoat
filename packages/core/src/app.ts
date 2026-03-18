import {
  appManifest,
  createBasicAuthHeader,
  sidecarBootstrapSchema,
  sidecarHealthSchema,
  type AppManifest,
  type SidecarBootstrap,
  type SidecarHealth,
  type WorkspaceArea,
} from "@opengoat/contracts";

export function getAppManifest(): AppManifest {
  return appManifest;
}

export function getWorkspaceAreas(): WorkspaceArea[] {
  return appManifest.workspaceLayout;
}

export function createSidecarHealth(version: string): SidecarHealth {
  return sidecarHealthSchema.parse({
    healthy: true,
    productName: appManifest.productName,
    version,
  });
}

export function createSidecarBootstrap(version: string): SidecarBootstrap {
  const payload = {
    manifest: appManifest,
    runtime: {
      auth: "basic",
      mode: "sidecar",
      streams: {
        sse: true,
        websocket: false,
      },
    },
    version,
  };

  return sidecarBootstrapSchema.parse(payload);
}

export function renderMetadataText(): string {
  const lines = [`Product: ${appManifest.productName}`, "Workspace areas:"];

  for (const area of appManifest.workspaceLayout) {
    lines.push(`- ${area.path}: ${area.responsibility}`);
  }

  return `${lines.join("\n")}\n`;
}

export function renderWorkspaceText(): string {
  return `${appManifest.workspaceLayout
    .map((area) => `${area.path}\t${area.responsibility}`)
    .join("\n")}\n`;
}

export { createBasicAuthHeader };
