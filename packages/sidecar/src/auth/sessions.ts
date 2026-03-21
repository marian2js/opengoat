import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import type { AuthSession, AuthSessionStep } from "@opengoat/contracts";
import type { RuntimeProviderAuthService } from "./service.ts";
import type { WizardPrompterLike } from "./runtime-modules.ts";

interface PendingBooleanResponse {
  resolve(value: boolean): void;
  step: Extract<AuthSessionStep, { type: "confirm_prompt" }>;
  type: "boolean";
}

interface PendingStringResponse {
  resolve(value: string): void;
  step: Extract<AuthSessionStep, { type: "text_prompt" }>;
  type: "string";
}

interface PendingSelectResponse {
  resolve(value: string | string[]): void;
  step: Extract<AuthSessionStep, { type: "select_prompt" }>;
  type: "select";
}

type PendingResponse =
  | PendingBooleanResponse
  | PendingStringResponse
  | PendingSelectResponse;

interface AuthSessionRecord {
  pendingResponse?: PendingResponse;
  snapshot: AuthSession;
}

interface CallbackInterceptor {
  close(): void;
}

/**
 * Port used by the embedded runtime's OpenAI Codex OAuth callback server.
 * We pre-bind this port so the runtime falls back to the text-prompt path,
 * then auto-resolve the prompt when the browser callback arrives at our server.
 */
const OAUTH_CALLBACK_PORT = 1455;

const CALLBACK_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign-in complete</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0a0a0a;
      color: #e5e5e5;
    }
    .card {
      text-align: center;
      padding: 2.5rem;
      border-radius: 12px;
      border: 1px solid #262626;
      background: #171717;
      max-width: 380px;
    }
    .icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      background: #166534;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { width: 24px; height: 24px; stroke: #4ade80; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; }
    p { font-size: 0.875rem; color: #a3a3a3; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
    <h1>Authentication successful</h1>
    <p>You can close this tab and return to the app.</p>
  </div>
</body>
</html>`;

export class RuntimeAuthSessionManager {
  readonly #createAuthService: () => RuntimeProviderAuthService;
  readonly #oauthCallbackCodes = new Map<string, string>();
  readonly #oauthCallbackResolvers = new Map<string, (value: string) => void>();
  readonly #onAuthComplete: (() => void) | undefined;
  readonly #sessions = new Map<string, AuthSessionRecord>();

  constructor(
    createAuthService: () => RuntimeProviderAuthService,
    options?: { onAuthComplete?: () => void },
  ) {
    this.#createAuthService = createAuthService;
    this.#onAuthComplete = options?.onAuthComplete;
  }

  get(sessionId: string): AuthSession | undefined {
    return this.#sessions.get(sessionId)?.snapshot;
  }

  async start(params: { authChoice: string }): Promise<AuthSession> {
    const authService = this.#createAuthService();
    const method = await authService.getMethod(params.authChoice);
    const snapshot: AuthSession = {
      authChoice: params.authChoice,
      id: randomUUID(),
      methodLabel: method.label,
      progress: ["Starting sign-in flow"],
      providerId: method.providerId,
      providerName: method.providerName,
      state: "pending",
      step: {
        message: "Preparing connection flow",
        type: "working",
      },
    };
    const record: AuthSessionRecord = { snapshot };
    this.#sessions.set(snapshot.id, record);

    void this.#run(record);

    return snapshot;
  }

  respond(
    sessionId: string,
    value: boolean | string | string[],
  ): AuthSession {
    const record = this.#sessions.get(sessionId);
    if (!record) {
      throw new Error(`Unknown auth session: ${sessionId}`);
    }

    if (!record.pendingResponse) {
      throw new Error("This sign-in flow is not waiting for input.");
    }

    const pending = record.pendingResponse;
    delete record.pendingResponse;

    if (pending.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new Error("Expected a yes/no response.");
      }
      this.#setStep(record, {
        message: "Continuing sign-in flow",
        type: "working",
      });
      pending.resolve(value);
      return record.snapshot;
    }

    if (pending.type === "string") {
      if (typeof value !== "string") {
        throw new Error("Expected text input.");
      }
      const nextValue = pending.step.allowEmpty ? value : value.trim();
      if (!pending.step.allowEmpty && nextValue.length === 0) {
        throw new Error("A value is required to continue.");
      }
      this.#setStep(record, {
        message: "Continuing sign-in flow",
        type: "working",
      });
      this.#cleanupOAuthCallback(sessionId);
      pending.resolve(nextValue);
      return record.snapshot;
    }

    if (
      typeof value !== "string" &&
      !(Array.isArray(value) && value.every((entry) => typeof entry === "string"))
    ) {
      throw new Error("Expected a selection response.");
    }

    if (!pending.step.allowMultiple && Array.isArray(value)) {
      throw new Error("Only one option can be selected for this step.");
    }

    this.#setStep(record, {
      message: "Continuing sign-in flow",
      type: "working",
    });
    pending.resolve(value);
    return record.snapshot;
  }

  async #run(record: AuthSessionRecord): Promise<void> {
    const authService = this.#createAuthService();

    // Pre-bind the OAuth callback port so the runtime falls back to its
    // text-prompt path. Our server captures the browser redirect instead.
    const interceptor = await this.#startCallbackInterceptor(record.snapshot.id);

    try {
      const result = await authService.applyAuthChoice({
        authChoice: record.snapshot.authChoice,
        prompter: this.#createPrompter(record),
      });

      if (!result.connection) {
        throw new Error(
          `${record.snapshot.methodLabel} did not create a saved connection.`,
        );
      }

      record.snapshot = {
        ...record.snapshot,
        connection: result.connection,
        progress: [...record.snapshot.progress, "Connection completed"].slice(-16),
        state: "completed",
        step: {
          message: `Connected ${result.connection.providerName}.`,
          type: "completed",
        },
      };

      this.#cleanupOAuthCallback(record.snapshot.id);

      try {
        this.#onAuthComplete?.();
      } catch {
        // Non-critical — auth sync failures should not block the session.
      }
    } catch (error) {
      const message = getErrorMessage(error);
      record.snapshot = {
        ...record.snapshot,
        error: message,
        progress: [...record.snapshot.progress, message].slice(-16),
        state: "error",
        step: {
          message,
          type: "error",
        },
      };
      if (record.pendingResponse) {
        delete record.pendingResponse;
      }
      this.#cleanupOAuthCallback(record.snapshot.id);
    } finally {
      interceptor?.close();
    }
  }

  /**
   * Starts a local HTTP server on the OAuth callback port (1455) to intercept
   * the browser redirect. When the callback arrives, the authorization code
   * is captured and used to auto-resolve the pending text prompt.
   *
   * If the port is already in use, returns null (manual paste still works).
   */
  async #startCallbackInterceptor(
    sessionId: string,
  ): Promise<CallbackInterceptor | null> {
    return new Promise((resolve) => {
      const server: Server = createServer((req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");

          if (url.pathname !== "/auth/callback") {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          const code = url.searchParams.get("code");
          if (code) {
            this.#receiveOAuthCallback(sessionId, code);
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(CALLBACK_SUCCESS_HTML);
        } catch {
          res.statusCode = 500;
          res.end("Internal error");
        }
      });

      server.listen(OAUTH_CALLBACK_PORT, "127.0.0.1", () => {
        resolve({
          close() {
            try {
              server.close();
            } catch {
              // Server already closed.
            }
          },
        });
      });

      server.on("error", () => {
        // Port already in use — fall back to manual paste.
        resolve(null);
      });
    });
  }

  /**
   * Called when the browser redirects to our callback interceptor with
   * an authorization code.
   */
  #receiveOAuthCallback(sessionId: string, code: string): void {
    // If the text prompt is already pending, resolve it directly.
    const resolver = this.#oauthCallbackResolvers.get(sessionId);
    if (resolver) {
      this.#oauthCallbackResolvers.delete(sessionId);
      // Call the resolver — it will clear pendingResponse and resolve the
      // text prompt promise internally.
      resolver(code);
      return;
    }

    // Otherwise store it for when text() is called.
    this.#oauthCallbackCodes.set(sessionId, code);
  }

  #createPrompter(record: AuthSessionRecord): WizardPrompterLike {
    return {
      authLink: (params) => {
        const step: Extract<AuthSessionStep, { type: "auth_link" }> = {
          ...(params.instructions ? { instructions: params.instructions } : {}),
          ...(params.label ? { label: params.label } : {}),
          type: "auth_link",
          url: params.url,
        };
        this.#setStep(record, step);
        return Promise.resolve();
      },
      confirm: async (params) => {
        const step: Extract<AuthSessionStep, { type: "confirm_prompt" }> = {
          ...(params.initialValue === false
            ? { cancelLabel: "No", confirmLabel: "Yes" }
            : {}),
          message: params.message,
          type: "confirm_prompt",
        };
        this.#setStep(record, step);
        return await new Promise<boolean>((resolve) => {
          record.pendingResponse = {
            resolve,
            step,
            type: "boolean",
          };
        });
      },
      intro: (title) => {
        this.#pushProgress(record, title);
        return Promise.resolve();
      },
      multiselect: <T,>(params: {
        initialValues?: T[];
        message: string;
        options: { hint?: string; label: string; value: T }[];
        searchable?: boolean;
      }) => {
        const options = params.options.map((option) => ({
          ...(option.hint ? { hint: option.hint } : {}),
          label: option.label,
          value: String(option.value),
        }));
        const step: Extract<AuthSessionStep, { type: "select_prompt" }> = {
          allowMultiple: true,
          message: params.message,
          options,
          type: "select_prompt",
        };
        this.#setStep(record, step);
        return new Promise<T[]>((resolve, reject) => {
          record.pendingResponse = {
            resolve: (result) => {
              const values = Array.isArray(result) ? result : [result];
              const valueSet = new Set(values);
              resolve(
                params.options
                  .filter((option) => valueSet.has(String(option.value)))
                  .map((option) => option.value),
              );
            },
            step,
            type: "select",
          };
          void reject;
        });
      },
      note: (message, title) => {
        this.#pushProgress(record, title ? `${title}: ${message}` : message);
        return Promise.resolve();
      },
      outro: (message) => {
        this.#pushProgress(record, message);
        return Promise.resolve();
      },
      progress: (label) => {
        this.#setStep(record, {
          message: label,
          type: "working",
        });
        return {
          stop: (message) => {
            if (message?.trim()) {
              this.#pushProgress(record, message.trim());
            }
          },
          update: (message) => {
            this.#setStep(record, {
              message,
              type: "working",
            });
          },
        };
      },
      select: <T,>(params: {
        initialValue?: T;
        message: string;
        options: { hint?: string; label: string; value: T }[];
      }) => {
        const options = params.options.map((option) => ({
          ...(option.hint ? { hint: option.hint } : {}),
          label: option.label,
          value: String(option.value),
        }));
        const step: Extract<AuthSessionStep, { type: "select_prompt" }> = {
          allowMultiple: false,
          message: params.message,
          options,
          type: "select_prompt",
        };
        this.#setStep(record, step);
        return new Promise<T>((resolve, reject) => {
          record.pendingResponse = {
            resolve: (result) => {
              const selectedValue = Array.isArray(result) ? result[0] : result;
              const matched = params.options.find(
                (option) => String(option.value) === selectedValue,
              );
              if (!matched) {
                reject(new Error("The selected option is no longer available."));
                return;
              }
              resolve(matched.value);
            },
            step,
            type: "select",
          };
        });
      },
      text: (params) => {
        const sessionId = record.snapshot.id;

        // If the OAuth callback already arrived, resolve immediately.
        if (isOAuthCodePrompt(params.message)) {
          const existingCode = this.#oauthCallbackCodes.get(sessionId);
          if (existingCode) {
            this.#oauthCallbackCodes.delete(sessionId);
            this.#pushProgress(record, "Sign-in completed via redirect");
            return Promise.resolve(existingCode);
          }
        }

        const step: Extract<AuthSessionStep, { type: "text_prompt" }> = {
          allowEmpty: false,
          message: params.message,
          ...(params.placeholder ? { placeholder: params.placeholder } : {}),
          secret: isSecretPrompt(params),
          type: "text_prompt",
        };
        this.#setStep(record, step);
        return new Promise<string>((resolve) => {
          record.pendingResponse = {
            resolve,
            step,
            type: "string",
          };

          // Also register for async OAuth callback resolution.
          if (isOAuthCodePrompt(params.message)) {
            this.#oauthCallbackResolvers.set(sessionId, (code) => {
              if (record.pendingResponse) {
                delete record.pendingResponse;
                this.#setStep(record, {
                  message: "Completing sign-in",
                  type: "working",
                });
                resolve(code);
              }
            });
          }
        });
      },
    };
  }

  #cleanupOAuthCallback(sessionId: string): void {
    this.#oauthCallbackCodes.delete(sessionId);
    this.#oauthCallbackResolvers.delete(sessionId);
  }

  #pushProgress(record: AuthSessionRecord, message: string): void {
    record.snapshot = {
      ...record.snapshot,
      progress: [...record.snapshot.progress, message].slice(-16),
    };
  }

  #setStep(record: AuthSessionRecord, step: AuthSessionStep): void {
    this.#pushProgress(
      record,
      "message" in step && typeof step.message === "string" ? step.message : record.snapshot.methodLabel,
    );
    record.snapshot = {
      ...record.snapshot,
      step,
    };
  }
}

function isOAuthCodePrompt(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("authorization code") || lower.includes("redirect url");
}

function isSecretPrompt(params: {
  message: string;
  placeholder?: string;
}): boolean {
  const haystack = `${params.message} ${params.placeholder ?? ""}`.toLowerCase();
  return haystack.includes("api key") || haystack.includes("token") || haystack.includes("secret");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
