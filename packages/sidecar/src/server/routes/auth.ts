import {
  authOverviewSchema,
  authSessionSchema,
  connectProviderSecretRequestSchema,
  providerModelCatalogSchema,
  respondAuthSessionRequestSchema,
  savedConnectionSchema,
  setProviderModelRequestSchema,
  selectConnectionRequestSchema,
  startAuthSessionRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createAuthRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/overview", async (context) => {
    const authOverview = await runtime.authService.getOverview();
    return context.json(authOverviewSchema.parse(authOverview));
  });

  app.get("/providers/:providerId/models", async (context) => {
    const catalog = await runtime.authService.getProviderModelCatalog(
      context.req.param("providerId"),
    );
    return context.json(providerModelCatalogSchema.parse(catalog));
  });

  app.post("/credentials", async (context) => {
    const payload = connectProviderSecretRequestSchema.parse(
      await context.req.json(),
    );
    const summary = await runtime.authService.connectSecret(payload);

    return context.json(savedConnectionSchema.parse(summary), 201);
  });

  app.post("/select", async (context) => {
    const payload = selectConnectionRequestSchema.parse(await context.req.json());
    const connection = await runtime.authService.selectProfile(payload.profileId);

    return context.json(savedConnectionSchema.parse(connection));
  });

  app.post("/providers/:providerId/model", async (context) => {
    const payload = setProviderModelRequestSchema.parse(await context.req.json());
    const overview = await runtime.authService.setProviderModel({
      modelRef: payload.modelRef,
      providerId: context.req.param("providerId"),
    });

    return context.json(authOverviewSchema.parse(overview));
  });

  app.delete("/profiles/:profileId", async (context) => {
    await runtime.authService.deleteProfile(context.req.param("profileId"));

    return context.body(null, 204);
  });

  app.post("/sessions", async (context) => {
    const payload = startAuthSessionRequestSchema.parse(await context.req.json());
    const session = await runtime.authSessions.start({
      authChoice: payload.authChoice,
    });
    return context.json(authSessionSchema.parse(session), 202);
  });

  app.get("/sessions/:sessionId", (context) => {
    const session = runtime.authSessions.get(context.req.param("sessionId"));
    if (!session) {
      return context.json({ error: "Auth session not found" }, 404);
    }

    return context.json(authSessionSchema.parse(session));
  });

  app.post("/sessions/:sessionId/respond", async (context) => {
    const payload = respondAuthSessionRequestSchema.parse(
      await context.req.json(),
    );
    const session = runtime.authSessions.respond(
      context.req.param("sessionId"),
      payload.value,
    );

    return context.json(authSessionSchema.parse(session));
  });

  return app;
}
