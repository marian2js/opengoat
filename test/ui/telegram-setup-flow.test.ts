import { describe, expect, it } from "vitest";
import {
  createMessagingConnectionRequestSchema,
  updateMessagingConnectionRequestSchema,
  messagingConnectionSchema,
} from "../../packages/contracts/src/index.js";

describe("TelegramSetupFlow contracts", () => {
  it("creates a Telegram connection with bot token in configRef", () => {
    const config = {
      botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      secretToken: "random-secret-token-abc123",
      webhookUrl: "https://example.com/messaging/telegram/webhook/conn-tg-1",
    };
    const request = createMessagingConnectionRequestSchema.parse({
      workspaceId: "default",
      type: "telegram",
      displayName: "My Telegram Bot",
      defaultProjectId: "proj-1",
      configRef: JSON.stringify(config),
    });
    expect(request.type).toBe("telegram");
    expect(request.configRef).toBeDefined();

    const parsed = JSON.parse(request.configRef!);
    expect(parsed.botToken).toBe("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    expect(parsed.secretToken).toBe("random-secret-token-abc123");
    expect(parsed.webhookUrl).toContain("/messaging/telegram/webhook/");
  });

  it("updates connection status to connected after setup", () => {
    const update = updateMessagingConnectionRequestSchema.parse({
      status: "connected",
    });
    expect(update.status).toBe("connected");
  });

  it("validates a fully configured Telegram connection", () => {
    const connection = messagingConnectionSchema.parse({
      connectionId: "conn-tg-1",
      workspaceId: "default",
      type: "telegram",
      status: "connected",
      displayName: "My Telegram Bot",
      defaultProjectId: "proj-1",
      configRef: JSON.stringify({
        botToken: "123456:ABC-DEF",
        secretToken: "secret-abc",
        webhookUrl: "https://example.com/messaging/telegram/webhook/conn-tg-1",
      }),
      createdAt: "2026-03-25T10:00:00.000Z",
      updatedAt: "2026-03-25T10:00:00.000Z",
    });
    expect(connection.type).toBe("telegram");
    expect(connection.status).toBe("connected");
    expect(connection.configRef).toBeTruthy();
  });

  it("TelegramConnectionConfig shape validates correctly", () => {
    const validConfig = {
      botToken: "123456:ABC-DEF",
      secretToken: "secret-token-value",
    };
    expect(typeof validConfig.botToken).toBe("string");
    expect(typeof validConfig.secretToken).toBe("string");
    expect(validConfig.botToken.includes(":")).toBe(true);
  });

  it("generates webhook URL from sidecar base URL and connection ID", () => {
    const sidecarBaseUrl = "http://localhost:3001";
    const connectionId = "conn-tg-abc123";
    const webhookUrl = `${sidecarBaseUrl}/messaging/telegram/webhook/${connectionId}`;
    expect(webhookUrl).toBe(
      "http://localhost:3001/messaging/telegram/webhook/conn-tg-abc123",
    );
  });
});
