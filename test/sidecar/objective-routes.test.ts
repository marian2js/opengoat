import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createObjectiveRoutes } from "../../packages/sidecar/src/server/routes/objectives.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

function createMockRuntime(overrides: Partial<SidecarRuntime["objectiveService"]> = {}) {
  const objectiveService = {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    setPrimaryActive: vi.fn(),
    ...overrides,
  };

  const runtime = {
    objectiveService,
    opengoatPaths: { homeDir: "/tmp/test" },
  } as unknown as SidecarRuntime;

  return { runtime, objectiveService };
}

function buildApp(runtime: SidecarRuntime) {
  const app = new Hono();
  app.route("/objectives", createObjectiveRoutes(runtime));
  return app;
}

const MOCK_OBJECTIVE = {
  objectiveId: "obj-1",
  projectId: "proj-1",
  title: "Launch on PH",
  goalType: "",
  status: "draft",
  summary: "",
  createdFrom: "manual",
  isPrimary: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Objective routes", () => {
  describe("POST /objectives", () => {
    it("creates an objective and returns 201", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.create.mockResolvedValue(MOCK_OBJECTIVE);
      const app = buildApp(runtime);

      const res = await app.request("/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "proj-1", title: "Launch on PH" }),
      });

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual(MOCK_OBJECTIVE);
      expect(objectiveService.create).toHaveBeenCalledWith(
        runtime.opengoatPaths,
        "proj-1",
        expect.objectContaining({ title: "Launch on PH" }),
      );
    });

    it("returns 400 when projectId is missing", async () => {
      const { runtime } = createMockRuntime();
      const app = buildApp(runtime);

      const res = await app.request("/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "No project" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /objectives", () => {
    it("lists objectives for a project", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.list.mockResolvedValue([MOCK_OBJECTIVE]);
      const app = buildApp(runtime);

      const res = await app.request("/objectives?projectId=proj-1");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([MOCK_OBJECTIVE]);
      expect(objectiveService.list).toHaveBeenCalledWith(
        runtime.opengoatPaths,
        { projectId: "proj-1", status: undefined },
      );
    });

    it("passes status filter", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.list.mockResolvedValue([]);
      const app = buildApp(runtime);

      await app.request("/objectives?projectId=proj-1&status=active");

      expect(objectiveService.list).toHaveBeenCalledWith(
        runtime.opengoatPaths,
        { projectId: "proj-1", status: "active" },
      );
    });

    it("returns 400 when projectId is missing", async () => {
      const { runtime } = createMockRuntime();
      const app = buildApp(runtime);

      const res = await app.request("/objectives");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /objectives/:objectiveId", () => {
    it("returns objective by id", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.get.mockResolvedValue(MOCK_OBJECTIVE);
      const app = buildApp(runtime);

      const res = await app.request("/objectives/obj-1");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(MOCK_OBJECTIVE);
    });

    it("returns 404 when objective not found", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.get.mockRejectedValue(new Error("Objective not found"));
      const app = buildApp(runtime);

      const res = await app.request("/objectives/missing");

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /objectives/:objectiveId", () => {
    it("updates an objective", async () => {
      const updated = { ...MOCK_OBJECTIVE, title: "Updated title" };
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.update.mockResolvedValue(updated);
      const app = buildApp(runtime);

      const res = await app.request("/objectives/obj-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated title" }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(updated);
      expect(objectiveService.update).toHaveBeenCalledWith(
        runtime.opengoatPaths,
        "obj-1",
        expect.objectContaining({ title: "Updated title" }),
      );
    });

    it("returns 404 when objective not found", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.update.mockRejectedValue(new Error("Objective not found"));
      const app = buildApp(runtime);

      const res = await app.request("/objectives/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nope" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /objectives/:objectiveId/archive", () => {
    it("archives an objective", async () => {
      const archived = { ...MOCK_OBJECTIVE, status: "abandoned", archivedAt: "2026-01-02T00:00:00.000Z" };
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.archive.mockResolvedValue(archived);
      const app = buildApp(runtime);

      const res = await app.request("/objectives/obj-1/archive", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(archived);
      expect(objectiveService.archive).toHaveBeenCalledWith(
        runtime.opengoatPaths,
        "obj-1",
      );
    });

    it("returns 404 when objective not found", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.archive.mockRejectedValue(new Error("Objective not found"));
      const app = buildApp(runtime);

      const res = await app.request("/objectives/missing/archive", { method: "POST" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /objectives/:objectiveId/set-primary", () => {
    it("sets primary active objective", async () => {
      const primary = { ...MOCK_OBJECTIVE, isPrimary: true, status: "active" };
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.setPrimaryActive.mockResolvedValue(primary);
      const app = buildApp(runtime);

      const res = await app.request("/objectives/obj-1/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "proj-1" }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(primary);
      expect(objectiveService.setPrimaryActive).toHaveBeenCalledWith(
        runtime.opengoatPaths,
        "proj-1",
        "obj-1",
      );
    });

    it("returns 400 when projectId is missing", async () => {
      const { runtime } = createMockRuntime();
      const app = buildApp(runtime);

      const res = await app.request("/objectives/obj-1/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when objective not found", async () => {
      const { runtime, objectiveService } = createMockRuntime();
      objectiveService.setPrimaryActive.mockRejectedValue(new Error("Objective not found"));
      const app = buildApp(runtime);

      const res = await app.request("/objectives/missing/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "proj-1" }),
      });

      expect(res.status).toBe(404);
    });
  });
});
