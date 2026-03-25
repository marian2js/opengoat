import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  createWhatsAppSessionRoutes,
  createWhatsAppQrRoutes,
} from "../packages/sidecar/src/server/routes/whatsapp-session.js";
import type { SidecarRuntime } from "../packages/sidecar/src/server/context.js";
import type { WhatsAppChannelService } from "../packages/core/src/core/whatsapp-channel/application/whatsapp-channel.service.js";

function createMockRuntime(): SidecarRuntime {
  return {
    whatsappChannelService: {
      startSession: vi.fn(),
      stopSession: vi.fn().mockResolvedValue(undefined),
      hasActiveSession: vi.fn().mockReturnValue(false),
    } as unknown as WhatsAppChannelService,
    opengoatPaths: {
      homeDir: "/tmp/test",
      workspacesDir: "/tmp/test/workspaces",
      projectsDir: "/tmp/test/projects",
      organizationDir: "/tmp/test/organization",
      agentsDir: "/tmp/test/agents",
      skillsDir: "/tmp/test/skills",
      providersDir: "/tmp/test/providers",
      sessionsDir: "/tmp/test/sessions",
      runsDir: "/tmp/test/runs",
      globalConfigJsonPath: "/tmp/test/config.json",
      globalConfigMarkdownPath: "/tmp/test/CONFIG.md",
      agentsIndexJsonPath: "/tmp/test/agents.json",
    },
  } as unknown as SidecarRuntime;
}

describe("WhatsApp Session Routes", () => {
  let runtime: SidecarRuntime;

  beforeEach(() => {
    runtime = createMockRuntime();
  });

  describe("POST /start-session/:connectionId", () => {
    it("delegates to whatsappChannelService.startSession", async () => {
      const app = new Hono();
      app.route("/", createWhatsAppSessionRoutes(runtime));

      const res = await app.request("/start-session/conn-wa-1", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe("POST /stop-session/:connectionId", () => {
    it("delegates to whatsappChannelService.stopSession", async () => {
      const app = new Hono();
      app.route("/", createWhatsAppSessionRoutes(runtime));

      const res = await app.request("/stop-session/conn-wa-1", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(
        runtime.whatsappChannelService.stopSession,
      ).toHaveBeenCalledWith("conn-wa-1");
    });
  });

  describe("GET /qr/:connectionId (SSE)", () => {
    it("returns SSE content type and streams events", async () => {
      // Mock startSession to yield events
      async function* mockGenerator() {
        yield { type: "status" as const, status: "connecting" as const };
        yield { type: "qr" as const, data: "data:image/png;base64,ABC" };
        yield { type: "status" as const, status: "connected" as const };
      }

      (
        runtime.whatsappChannelService.startSession as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockGenerator());

      const app = new Hono();
      app.route("/", createWhatsAppQrRoutes(runtime));

      const res = await app.request("/qr/conn-wa-1");

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      // Read the full SSE body
      const text = await res.text();
      expect(text).toContain('"type":"qr"');
      expect(text).toContain('"status":"connected"');
    });

    it("handles connection that yields no events gracefully", async () => {
      async function* emptyGenerator() {
        // yields nothing
      }

      (
        runtime.whatsappChannelService.startSession as ReturnType<typeof vi.fn>
      ).mockReturnValue(emptyGenerator());

      const app = new Hono();
      app.route("/", createWhatsAppQrRoutes(runtime));

      const res = await app.request("/qr/conn-wa-1");

      expect(res.status).toBe(200);
    });
  });
});
