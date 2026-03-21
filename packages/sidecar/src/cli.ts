import { startSidecarServer } from "./index.ts";
import { sidecarLogger } from "./logger.ts";

async function main(): Promise<void> {
  const server = await startSidecarServer();

  const shutdown = () => {
    sidecarLogger.info("shutting down");
    void server.close();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main().catch((error: unknown) => {
  sidecarLogger.error("fatal", error);
  process.exit(1);
});
