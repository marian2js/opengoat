import type { WorkbenchService } from "@main/state/workbench-service";
import {
  addProjectInputSchema,
  createSessionInputSchema,
  sendMessageInputSchema,
  sessionLookupInputSchema,
  submitOnboardingInputSchema,
} from "@shared/workbench";
import { getTRPCErrorFromUnknown, initTRPC, type AnyRouter } from "@trpc/server";
import { getErrorShape } from "@trpc/server/shared";
import superjson from "superjson";

const t = initTRPC.create({ transformer: superjson });

export function createDesktopRouter(service: WorkbenchService) {
  const router = t.router({
    bootstrap: t.procedure.query(async () => {
      return service.bootstrap();
    }),
    bootstrapMutate: t.procedure.mutation(async () => {
      return service.bootstrap();
    }),
    projects: t.router({
      list: t.procedure.query(async () => {
        return service.listProjects();
      }),
      listMutate: t.procedure.mutation(async () => {
        return service.listProjects();
      }),
      add: t.procedure
        .input(addProjectInputSchema)
        .mutation(async ({ input }) => {
          return service.addProject(input.rootPath);
        }),
      pick: t.procedure.mutation(async () => {
        return service.pickAndAddProject();
      }),
    }),
    sessions: t.router({
      list: t.procedure
        .input(createSessionInputSchema.pick({ projectId: true }))
        .query(async ({ input }) => {
          return service.listSessions(input.projectId);
        }),
      listMutate: t.procedure
        .input(createSessionInputSchema.pick({ projectId: true }))
        .mutation(async ({ input }) => {
          return service.listSessions(input.projectId);
        }),
      create: t.procedure
        .input(createSessionInputSchema)
        .mutation(async ({ input }) => {
          return service.createSession(input.projectId, input.title);
        }),
      messages: t.procedure
        .input(sessionLookupInputSchema)
        .query(async ({ input }) => {
          return service.listMessages(input.projectId, input.sessionId);
        }),
      messagesMutate: t.procedure
        .input(sessionLookupInputSchema)
        .mutation(async ({ input }) => {
          return service.listMessages(input.projectId, input.sessionId);
        }),
    }),
    onboarding: t.router({
      status: t.procedure.query(async () => {
        return service.getOnboardingState();
      }),
      statusMutate: t.procedure.mutation(async () => {
        return service.getOnboardingState();
      }),
      submit: t.procedure
        .input(submitOnboardingInputSchema)
        .mutation(async ({ input }) => {
          return service.submitOnboarding(input);
        }),
    }),
    chat: t.router({
      send: t.procedure
        .input(sendMessageInputSchema)
        .mutation(async ({ input }) => {
          return service.sendMessage(input);
      }),
    }),
  });

  return ensureRouterErrorShape(router);
}

export type AppRouter = ReturnType<typeof createDesktopRouter>;

function ensureRouterErrorShape<TRouter extends AnyRouter>(router: TRouter): TRouter {
  const mutableRouter = router as TRouter & {
    getErrorShape?: (input: {
      error: unknown;
      type: "query" | "mutation" | "subscription";
      path: string;
      input: unknown;
      ctx: unknown;
    }) => unknown;
  };

  if (typeof mutableRouter.getErrorShape !== "function") {
    mutableRouter.getErrorShape = ({ error, type, path, input, ctx }) =>
      getErrorShape({
        config: router._def._config,
        error: getTRPCErrorFromUnknown(error),
        type,
        path,
        input,
        ctx,
      });
  }

  return router;
}
