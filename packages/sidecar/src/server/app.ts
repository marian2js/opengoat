import { createBasicAuthHeader } from "@opengoat/core";
import type { HttpBindings } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { sidecarLogger } from "../logger.ts";
import { createAgentRoutes } from "./routes/agents.ts";
import { createArtifactRoutes, createBundleRoutes } from "./routes/artifacts.ts";
import { createAuthRoutes } from "./routes/auth.ts";
import { createChatRoutes } from "./routes/chat.ts";
import { createGlobalRoutes } from "./routes/global.ts";
import { createMemoryRoutes } from "./routes/memory.ts";
import { createObjectiveRoutes } from "./routes/objectives.ts";
import { createPlaybookRoutes } from "./routes/playbooks.ts";
import { createRunRoutes } from "./routes/runs.ts";
import { createSignalRoutes } from "./routes/signals.ts";
import { createTaskRoutes } from "./routes/tasks.ts";
import type { SidecarRuntime } from "./context.ts";

const TAURI_ORIGINS = new Set([
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
]);

export function createSidecarApp(runtime: SidecarRuntime): Hono<{
  Bindings: HttpBindings;
}> {
  const app = new Hono<{
    Bindings: HttpBindings;
  }>();

  app.use(
    "*",
    cors({
      origin(origin) {
        if (!origin) {
          return origin;
        }

        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          return origin;
        }

        if (TAURI_ORIGINS.has(origin)) {
          return origin;
        }

        return undefined;
      },
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.use("*", async (context, next) => {
    if (context.req.method === "OPTIONS") {
      return next();
    }

    const expected = createBasicAuthHeader(
      runtime.config.username,
      runtime.config.password,
    );
    const actual = context.req.header("authorization");

    if (actual !== expected) {
      context.header("WWW-Authenticate", 'Basic realm="OpenGoat API"');
      return context.json({ error: "Unauthorized" }, 401);
    }

    return next();
  });

  app.route("/agents", createAgentRoutes(runtime));
  app.route("/artifacts", createArtifactRoutes(runtime));
  app.route("/bundles", createBundleRoutes(runtime));
  app.route("/chat", createChatRoutes(runtime));
  app.route("/global", createGlobalRoutes(runtime));
  app.route("/auth", createAuthRoutes(runtime));
  app.route("/memories", createMemoryRoutes(runtime));
  app.route("/objectives", createObjectiveRoutes(runtime));
  app.route("/playbooks", createPlaybookRoutes(runtime));
  app.route("/runs", createRunRoutes(runtime));
  app.route("/signals", createSignalRoutes(runtime));
  app.route("/tasks", createTaskRoutes(runtime));

  app.notFound((context) => context.json({ error: "Not Found" }, 404));
  app.onError((error, context) => {
    sidecarLogger.error("unhandled error", error);
    return context.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
