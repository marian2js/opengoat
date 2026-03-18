import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmbeddedGatewayPaths } from "./paths.ts";

type GatewayConfig = Record<string, unknown>;

function createEmptyConfig(): GatewayConfig {
  return {};
}

async function loadExistingConfig(configPath: string): Promise<GatewayConfig> {
  try {
    const source = await readFile(configPath, "utf8");
    const parsed = JSON.parse(source) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as GatewayConfig)
      : createEmptyConfig();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return createEmptyConfig();
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid embedded runtime config JSON at ${configPath}.`);
    }
    throw error;
  }
}

export async function writeEmbeddedGatewayConfig(params: {
  paths: EmbeddedGatewayPaths;
  port: number;
  token: string;
}): Promise<void> {
  const payload = await loadExistingConfig(params.paths.configPath);

  await writeFile(
    params.paths.configPath,
    `${JSON.stringify(
      {
        ...payload,
        discovery: {
          ...((payload.discovery &&
            typeof payload.discovery === "object" &&
            !Array.isArray(payload.discovery)
            ? payload.discovery
            : {}) as Record<string, unknown>),
          mdns: {
            ...((((payload.discovery as Record<string, unknown> | undefined)?.mdns &&
              typeof (payload.discovery as Record<string, unknown>).mdns === "object" &&
              !Array.isArray((payload.discovery as Record<string, unknown>).mdns)
              ? (payload.discovery as Record<string, unknown>).mdns
              : {}) as Record<string, unknown>)),
            mode: "off",
          },
          wideArea: {
            ...((((payload.discovery as Record<string, unknown> | undefined)?.wideArea &&
              typeof (payload.discovery as Record<string, unknown>).wideArea === "object" &&
              !Array.isArray((payload.discovery as Record<string, unknown>).wideArea)
              ? (payload.discovery as Record<string, unknown>).wideArea
              : {}) as Record<string, unknown>)),
            enabled: false,
          },
        },
        gateway: {
          ...((payload.gateway &&
            typeof payload.gateway === "object" &&
            !Array.isArray(payload.gateway)
            ? payload.gateway
            : {}) as Record<string, unknown>),
          auth: {
            ...((((payload.gateway as Record<string, unknown> | undefined)?.auth &&
              typeof (payload.gateway as Record<string, unknown>).auth === "object" &&
              !Array.isArray((payload.gateway as Record<string, unknown>).auth)
              ? (payload.gateway as Record<string, unknown>).auth
              : {}) as Record<string, unknown>)),
            mode: "token",
            token: params.token,
          },
          bind: "loopback",
          controlUi: {
            ...((((payload.gateway as Record<string, unknown> | undefined)?.controlUi &&
              typeof (payload.gateway as Record<string, unknown>).controlUi === "object" &&
              !Array.isArray((payload.gateway as Record<string, unknown>).controlUi)
              ? (payload.gateway as Record<string, unknown>).controlUi
              : {}) as Record<string, unknown>)),
            enabled: false,
          },
          port: params.port,
        },
        logging: {
          ...((payload.logging &&
            typeof payload.logging === "object" &&
            !Array.isArray(payload.logging)
            ? payload.logging
            : {}) as Record<string, unknown>),
          file: join(params.paths.logsDir, "gateway.log"),
          level: "info",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
