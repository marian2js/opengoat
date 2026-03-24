import { describe, expect, it } from "vitest";
import {
  messagingConnectionSchema,
  messagingConnectionListSchema,
  createMessagingConnectionRequestSchema,
  updateMessagingConnectionRequestSchema,
  messagingConnectionTypeSchema,
  messagingConnectionStatusSchema,
} from "../../packages/contracts/src/index.js";

describe("MessagingConnectionsPanel contracts", () => {
  it("validates a messaging connection schema", () => {
    const connection = {
      connectionId: "conn-abc12345",
      workspaceId: "ws-1",
      type: "telegram",
      status: "connected",
      displayName: "My Telegram Bot",
      defaultProjectId: "proj-1",
      configRef: "bot-token-ref",
      createdAt: "2026-03-24T12:00:00.000Z",
      updatedAt: "2026-03-24T12:00:00.000Z",
    };
    const parsed = messagingConnectionSchema.parse(connection);
    expect(parsed.connectionId).toBe("conn-abc12345");
    expect(parsed.type).toBe("telegram");
    expect(parsed.status).toBe("connected");
  });

  it("validates connection list schema", () => {
    const list = [
      {
        connectionId: "conn-1",
        workspaceId: "ws-1",
        type: "telegram",
        status: "pending",
        displayName: "TG Bot",
        defaultProjectId: "proj-1",
        configRef: null,
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
      },
      {
        connectionId: "conn-2",
        workspaceId: "ws-1",
        type: "whatsapp",
        status: "connected",
        displayName: "WA",
        defaultProjectId: "proj-1",
        configRef: "session-ref",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
      },
    ];
    const parsed = messagingConnectionListSchema.parse(list);
    expect(parsed).toHaveLength(2);
  });

  it("validates create request schema", () => {
    const request = {
      workspaceId: "ws-1",
      type: "whatsapp",
      displayName: "My WA",
      defaultProjectId: "proj-1",
    };
    const parsed = createMessagingConnectionRequestSchema.parse(request);
    expect(parsed.type).toBe("whatsapp");
  });

  it("validates update request schema", () => {
    const request = {
      status: "connected",
      configRef: "new-ref",
    };
    const parsed = updateMessagingConnectionRequestSchema.parse(request);
    expect(parsed.status).toBe("connected");
  });

  it("validates connection type enum", () => {
    expect(messagingConnectionTypeSchema.parse("telegram")).toBe("telegram");
    expect(messagingConnectionTypeSchema.parse("whatsapp")).toBe("whatsapp");
    expect(() => messagingConnectionTypeSchema.parse("slack")).toThrow();
  });

  it("validates connection status enum", () => {
    const validStatuses = ["pending", "connected", "disconnected", "error"];
    for (const status of validStatuses) {
      expect(messagingConnectionStatusSchema.parse(status)).toBe(status);
    }
    expect(() => messagingConnectionStatusSchema.parse("unknown")).toThrow();
  });

  it("validates null configRef", () => {
    const connection = {
      connectionId: "conn-1",
      workspaceId: "ws-1",
      type: "telegram",
      status: "pending",
      displayName: "TG",
      defaultProjectId: "proj-1",
      configRef: null,
      createdAt: "2026-03-24T12:00:00.000Z",
      updatedAt: "2026-03-24T12:00:00.000Z",
    };
    const parsed = messagingConnectionSchema.parse(connection);
    expect(parsed.configRef).toBeNull();
  });
});
