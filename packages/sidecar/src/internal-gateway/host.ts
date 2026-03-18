import { setTimeout as delay } from "node:timers/promises";
import { resolveGatewayInternalImport } from "./package-paths.ts";

interface ImportedGatewayServerModule {
  startGatewayServer(
    port: number,
    options: {
      auth: { mode: "token"; token: string };
      bind: "loopback";
      controlUiEnabled: false;
      openAiChatCompletionsEnabled: false;
      openResponsesEnabled: false;
    },
  ): Promise<{
    close(): Promise<void>;
  }>;
}

async function loadGatewayServerModule(): Promise<ImportedGatewayServerModule> {
  return (await import(
    resolveGatewayInternalImport("dist/gateway/server.js")
  )) as ImportedGatewayServerModule;
}

async function main(): Promise<void> {
  const token = process.env.OPENGOAT_GATEWAY_TOKEN?.trim();
  const port = Number.parseInt(process.env.OPENGOAT_GATEWAY_PORT ?? "", 10);
  if (!token) {
    throw new Error("Missing OPENGOAT_GATEWAY_TOKEN.");
  }
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("Missing or invalid OPENGOAT_GATEWAY_PORT.");
  }

  const gatewayModule = await loadGatewayServerModule();
  const server = await gatewayModule.startGatewayServer(port, {
    auth: {
      mode: "token",
      token,
    },
    bind: "loopback",
    controlUiEnabled: false,
    openAiChatCompletionsEnabled: false,
    openResponsesEnabled: false,
  });

  let closed = false;
  const shutdown = async () => {
    if (closed) {
      return;
    }

    closed = true;
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  await new Promise<void>(() => {
    const keepAlive = setInterval(() => {
      void delay(0);
    }, 60_000);
    keepAlive.unref();
  });
}

void main().catch((error: unknown) => {
  console.error("[gateway-host] fatal", error);
  process.exit(1);
});
