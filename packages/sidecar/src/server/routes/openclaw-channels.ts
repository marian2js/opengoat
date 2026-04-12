import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { Context } from "hono";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import type { EmbeddedGatewayPaths } from "../../internal-gateway/paths.ts";
import { resolveGatewayCliEntrypoint } from "../../internal-gateway/package-paths.ts";

const openClawMessagingChannelIdSchema = z.enum(["telegram", "whatsapp"]);

const openClawMessagingChannelSchema = z.object({
  accountId: z.string().min(1),
  channelId: openClawMessagingChannelIdSchema,
  configured: z.boolean(),
  enabled: z.boolean(),
  label: z.string().min(1),
  linked: z.boolean().nullable().optional(),
  summary: z.string().min(1),
});

const openClawMessagingChannelListSchema = z.array(
  openClawMessagingChannelSchema,
);

const connectOpenClawTelegramRequestSchema = z.object({
  botToken: z.string().min(1),
});

type OpenClawMessagingChannel = z.infer<typeof openClawMessagingChannelSchema>;

export function createOpenClawChannelRoutes(runtime: {
  gatewaySupervisor: {
    paths: EmbeddedGatewayPaths;
  };
}): Hono {
  const app = new Hono();

  app.get("/channels", async (context) => {
    const channels = await listOpenClawMessagingChannels(
      runtime.gatewaySupervisor.paths,
    );
    return context.json(openClawMessagingChannelListSchema.parse(channels));
  });

  app.post("/channels/telegram/connect", async (context) => {
    const payload = connectOpenClawTelegramRequestSchema.parse(
      await context.req.json(),
    );
    const result = await runOpenClawCommand(runtime.gatewaySupervisor.paths, [
      "channels",
      "add",
      "--channel",
      "telegram",
      "--token",
      payload.botToken,
    ]);

    if (result.code !== 0) {
      return context.json(
        { error: formatCommandFailure(result) },
        400,
      );
    }

    const channels = await listOpenClawMessagingChannels(
      runtime.gatewaySupervisor.paths,
    );
    return context.json(openClawMessagingChannelListSchema.parse(channels));
  });

  app.delete("/channels/:channelId", async (context) => {
    const channelId = openClawMessagingChannelIdSchema.parse(
      context.req.param("channelId"),
    );

    if (channelId === "whatsapp") {
      await runOpenClawCommand(runtime.gatewaySupervisor.paths, [
        "channels",
        "logout",
        "--channel",
        "whatsapp",
      ]).catch(() => undefined);
    }

    const result = await runOpenClawCommand(runtime.gatewaySupervisor.paths, [
      "channels",
      "remove",
      "--channel",
      channelId,
      "--delete",
    ]);

    if (result.code !== 0) {
      return context.json(
        { error: formatCommandFailure(result) },
        400,
      );
    }

    return context.body(null, 204);
  });

  app.post("/channels/whatsapp/login", async (context) => {
    preparePlainTextStream(context);

    return stream(context, async (output) => {
      const abortController = new AbortController();
      output.onAbort(() => {
        abortController.abort();
      });

      const queue = createWriteQueue((chunk) => output.write(chunk));
      const enqueue = (chunk: string) => {
        queue.write(chunk);
      };

      const ensureResult = await runOpenClawCommand(
        runtime.gatewaySupervisor.paths,
        ["channels", "add", "--channel", "whatsapp"],
      );
      if (ensureResult.stdout) {
        enqueue(ensureResult.stdout);
      }
      if (ensureResult.stderr) {
        enqueue(ensureResult.stderr);
      }
      if (ensureResult.code !== 0) {
        await queue.flush();
        return;
      }

      const loginResult = await runOpenClawCommand(
        runtime.gatewaySupervisor.paths,
        ["channels", "login", "--channel", "whatsapp"],
        {
          abortSignal: abortController.signal,
          onStderr: enqueue,
          onStdout: enqueue,
        },
      ).catch((error: unknown) => ({
        code: abortController.signal.aborted ? 130 : 1,
        stderr: error instanceof Error ? `${error.message}\n` : `${String(error)}\n`,
        stdout: "",
      }));

      if (
        loginResult.code !== 0 &&
        !abortController.signal.aborted &&
        loginResult.stderr.trim().length === 0 &&
        loginResult.stdout.trim().length === 0
      ) {
        enqueue("OpenClaw login exited before completing the link flow.\n");
      }

      await queue.flush();
    });
  });

  return app;
}

async function listOpenClawMessagingChannels(
  paths: EmbeddedGatewayPaths,
): Promise<OpenClawMessagingChannel[]> {
  const [config, statusResult] = await Promise.all([
    readOpenClawConfig(paths),
    runOpenClawCommand(paths, ["channels", "status"]),
  ]);

  const statusByChannel = parseStatusSummary(statusResult.stdout);

  return [
    buildChannelSummary({
      channelId: "telegram",
      configured:
        resolveConfiguredFromStatus("telegram", statusByChannel.telegram) ??
        hasTelegramToken(config),
      enabled:
        resolveEnabledFromStatus(statusByChannel.telegram) ?? isTelegramEnabled(config),
      summary: statusByChannel.telegram,
    }),
    buildChannelSummary({
      channelId: "whatsapp",
      configured:
        resolveConfiguredFromStatus("whatsapp", statusByChannel.whatsapp) ??
        hasWhatsAppAccount(config),
      enabled:
        resolveEnabledFromStatus(statusByChannel.whatsapp) ?? isWhatsAppEnabled(config),
      summary: statusByChannel.whatsapp,
    }),
  ];
}

function buildChannelSummary(params: {
  channelId: "telegram" | "whatsapp";
  configured: boolean;
  enabled: boolean;
  summary: string | undefined;
}): OpenClawMessagingChannel {
  const isWhatsApp = params.channelId === "whatsapp";
  const linked = isWhatsApp
    ? params.summary
      ? !params.summary.toLowerCase().includes("not linked")
      : false
    : null;

  return {
    accountId: "default",
    channelId: params.channelId,
    configured: params.configured,
    enabled: params.enabled,
    label: params.channelId === "telegram" ? "Telegram" : "WhatsApp",
    ...(isWhatsApp ? { linked } : {}),
    summary:
      params.summary ??
      (!params.configured
        ? "Not configured"
        : isWhatsApp
          ? "Configured in OpenClaw. Start the QR link flow to finish setup."
          : "Bot token configured in OpenClaw."),
  };
}

async function runOpenClawCommand(
  paths: EmbeddedGatewayPaths,
  args: string[],
  options: {
    abortSignal?: AbortSignal;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
  } = {},
): Promise<{
  code: number;
  stderr: string;
  stdout: string;
}> {
  return await new Promise((resolve, reject) => {
    if (options.abortSignal?.aborted) {
      reject(createAbortError());
      return;
    }

    const child = spawn(
      process.execPath,
      [resolveGatewayCliEntrypoint(), ...args],
      {
        env: {
          ...process.env,
          OPENCLAW_CONFIG_PATH: paths.configPath,
          OPENCLAW_OAUTH_DIR: paths.oauthDir,
          OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
          OPENCLAW_STATE_DIR: paths.stateDir,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const cleanup = () => {
      options.abortSignal?.removeEventListener("abort", handleAbort);
    };

    const finish = (result: { code: number; stderr: string; stdout: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAbort = () => {
      child.kill("SIGTERM");
      fail(createAbortError());
    };

    options.abortSignal?.addEventListener("abort", handleAbort, {
      once: true,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options.onStderr?.(text);
    });

    child.on("error", (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });

    child.on("close", (code) => {
      finish({
        code: code ?? 1,
        stderr,
        stdout,
      });
    });
  });
}

async function readOpenClawConfig(
  paths: EmbeddedGatewayPaths,
): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(paths.configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function parseStatusSummary(stdout: string): Record<"telegram" | "whatsapp", string | undefined> {
  const result: Record<"telegram" | "whatsapp", string | undefined> = {
    telegram: undefined,
    whatsapp: undefined,
  };

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    const match = /^- (Telegram|WhatsApp) [^:]+: (.+)$/.exec(line);
    if (!match) {
      continue;
    }

    const label = match[1];
    const summary = match[2];
    if (!label || !summary) {
      continue;
    }

    const channelId = label.toLowerCase() as "telegram" | "whatsapp";
    result[channelId] = summary.trim();
  }

  return result;
}

function resolveConfiguredFromStatus(
  channelId: "telegram" | "whatsapp",
  summary: string | undefined,
): boolean | undefined {
  const normalized = summary?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("not configured")) {
    return false;
  }

  if (channelId === "whatsapp" && normalized.includes("not linked")) {
    return true;
  }

  if (normalized.includes("configured")) {
    return true;
  }

  return undefined;
}

function resolveEnabledFromStatus(summary: string | undefined): boolean | undefined {
  const normalized = summary?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("enabled")) {
    return true;
  }

  if (normalized.startsWith("disabled")) {
    return false;
  }

  return undefined;
}

function hasTelegramToken(config: Record<string, unknown>): boolean {
  const telegram = asRecord(asRecord(config.channels).telegram);
  return readOptionalString(telegram.botToken) !== undefined;
}

function hasWhatsAppAccount(config: Record<string, unknown>): boolean {
  const whatsapp = asRecord(asRecord(config.channels).whatsapp);
  const accounts = asRecord(whatsapp.accounts);
  return Object.keys(accounts).length > 0;
}

function isTelegramEnabled(config: Record<string, unknown>): boolean {
  const telegram = asRecord(asRecord(config.channels).telegram);
  return telegram.enabled !== false && hasTelegramToken(config);
}

function isWhatsAppEnabled(config: Record<string, unknown>): boolean {
  const whatsapp = asRecord(asRecord(config.channels).whatsapp);
  const defaultAccount = asRecord(asRecord(whatsapp.accounts).default);
  if (Object.keys(defaultAccount).length === 0) {
    return false;
  }
  return defaultAccount.enabled !== false;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function formatCommandFailure(result: {
  stderr: string;
  stdout: string;
}): string {
  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return stderr;
  }

  const stdout = result.stdout.trim();
  if (stdout.length > 0) {
    return stdout;
  }

  return "OpenClaw command failed.";
}

function preparePlainTextStream(context: Context): void {
  context.header("Cache-Control", "no-cache");
  context.header("Connection", "keep-alive");
  context.header("Content-Type", "text/plain; charset=utf-8");
  context.header("X-Accel-Buffering", "no");
  context.header("X-Content-Type-Options", "nosniff");
}

function createWriteQueue(write: (chunk: string) => Promise<unknown>) {
  let chain = Promise.resolve();

  return {
    flush() {
      return chain;
    },
    write(chunk: string) {
      chain = chain.then(() => write(chunk));
    },
  };
}

function createAbortError(): Error {
  const error = new Error("Command execution aborted.");
  error.name = "AbortError";
  return error;
}
