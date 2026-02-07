import { initTRPC } from "@trpc/server";
import {
  addProjectInputSchema,
  createSessionInputSchema,
  sendMessageInputSchema,
  sessionLookupInputSchema
} from "@shared/workbench";
import type { WorkbenchService } from "@main/state/workbench-service";

const t = initTRPC.create();

export function createDesktopRouter(service: WorkbenchService) {
  return t.router({
    bootstrap: t.procedure.query(async () => {
      return service.bootstrap();
    }),
    projects: t.router({
      list: t.procedure.query(async () => {
        return service.listProjects();
      }),
      add: t.procedure.input(addProjectInputSchema).mutation(async ({ input }) => {
        return service.addProject(input.rootPath);
      }),
      pick: t.procedure.mutation(async () => {
        return service.pickAndAddProject();
      })
    }),
    sessions: t.router({
      list: t.procedure
        .input(createSessionInputSchema.pick({ projectId: true }))
        .query(async ({ input }) => {
          return service.listSessions(input.projectId);
        }),
      create: t.procedure.input(createSessionInputSchema).mutation(async ({ input }) => {
        return service.createSession(input.projectId, input.title);
      }),
      messages: t.procedure.input(sessionLookupInputSchema).query(async ({ input }) => {
        return service.listMessages(input.projectId, input.sessionId);
      })
    }),
    chat: t.router({
      send: t.procedure.input(sendMessageInputSchema).mutation(async ({ input }) => {
        return service.sendMessage(input);
      })
    })
  });
}

export type AppRouter = ReturnType<typeof createDesktopRouter>;
