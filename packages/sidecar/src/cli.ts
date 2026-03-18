import { startSidecarServer } from "./index.ts";

async function main(): Promise<void> {
  const server = await startSidecarServer();

  const shutdown = () => {
    console.error("[sidecar] shutting down");
    void server.close();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main().catch((error: unknown) => {
  console.error("[sidecar] fatal", error);
  process.exit(1);
});
