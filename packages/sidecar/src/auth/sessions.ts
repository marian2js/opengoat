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

export class RuntimeAuthSessionManager {
  readonly #createAuthService: () => RuntimeProviderAuthService;
  readonly #sessions = new Map<string, AuthSessionRecord>();

  constructor(createAuthService: () => RuntimeProviderAuthService) {
    this.#createAuthService = createAuthService;
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
    }
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
        });
      },
    };
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
