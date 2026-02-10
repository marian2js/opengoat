import { createOpenGoatUiServer } from "./app.js";

export const DEFAULT_PORT = 19123;

async function main(): Promise<void> {
  const port = resolvePort(process.env.OPENGOAT_UI_PORT ?? process.env.PORT, DEFAULT_PORT);
  const host = (process.env.OPENGOAT_UI_HOST || "127.0.0.1").trim() || "127.0.0.1";
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";

  const server = await createOpenGoatUiServer({
    mode,
    logger: true
  });

  await server.listen({
    port,
    host
  });

  server.log.info(
    {
      host,
      port,
      mode
    },
    "OpenGoat UI server is running"
  );
}

function resolvePort(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`OpenGoat UI failed to start: ${message}\n`);
  process.exitCode = 1;
});
