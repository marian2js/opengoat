import { specialistRosterSchema } from "@opengoat/contracts";
import { getSpecialistRoster } from "@opengoat/core";
import { Hono } from "hono";

export function createSpecialistRoutes(): Hono {
  const app = new Hono();

  app.get("/", (context) => {
    const roster = { specialists: getSpecialistRoster() };
    return context.json(specialistRosterSchema.parse(roster));
  });

  return app;
}
