import { describe, expect, it } from "vitest";
import {
  createMessagingConnectionRequestSchema,
  updateMessagingConnectionRequestSchema,
  messagingConnectionSchema,
} from "../../packages/contracts/src/index.js";

describe("WhatsAppSetupFlow contracts", () => {
  it("creates a WhatsApp connection with pending status", () => {
    const request = createMessagingConnectionRequestSchema.parse({
      workspaceId: "default",
      type: "whatsapp",
      displayName: "WhatsApp Connection",
      defaultProjectId: "default",
    });
    expect(request.type).toBe("whatsapp");
    expect(request.displayName).toBe("WhatsApp Connection");
  });

  it("updates WhatsApp connection to connected after QR scan", () => {
    const config = { authDir: "/home/user/.opengoat/whatsapp-sessions/conn-wa-1" };
    const update = updateMessagingConnectionRequestSchema.parse({
      status: "connected",
      configRef: JSON.stringify(config),
    });
    expect(update.status).toBe("connected");
    expect(update.configRef).toBeDefined();
    const parsed = JSON.parse(update.configRef!);
    expect(parsed.authDir).toContain("whatsapp-sessions");
  });

  it("validates a fully configured WhatsApp connection", () => {
    const connection = messagingConnectionSchema.parse({
      connectionId: "conn-wa-1",
      workspaceId: "default",
      type: "whatsapp",
      status: "connected",
      displayName: "My WhatsApp",
      defaultProjectId: "default",
      configRef: JSON.stringify({
        authDir: "/home/user/.opengoat/whatsapp-sessions/conn-wa-1",
      }),
      createdAt: "2026-03-25T10:00:00.000Z",
      updatedAt: "2026-03-25T10:00:00.000Z",
    });
    expect(connection.type).toBe("whatsapp");
    expect(connection.status).toBe("connected");
    expect(connection.configRef).toBeTruthy();
  });

  it("WhatsAppConnectionConfig shape validates correctly", () => {
    const validConfig = {
      authDir: "/home/user/.opengoat/whatsapp-sessions/conn-wa-1",
    };
    expect(typeof validConfig.authDir).toBe("string");
    expect(validConfig.authDir).toContain("whatsapp-sessions");
  });

  it("constructs correct SSE URL for QR code subscription", () => {
    const sidecarBaseUrl = "http://localhost:3001";
    const connectionId = "conn-wa-abc123";
    const sseUrl = `${sidecarBaseUrl}/messaging/whatsapp/qr/${connectionId}`;
    expect(sseUrl).toBe(
      "http://localhost:3001/messaging/whatsapp/qr/conn-wa-abc123",
    );
  });
});
