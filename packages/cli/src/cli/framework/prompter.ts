import { createInterface } from "node:readline/promises";
import {
  cancel as clackCancel,
  confirm as clackConfirm,
  intro as clackIntro,
  isCancel,
  note as clackNote,
  outro as clackOutro,
  password as clackPassword,
  select as clackSelect,
  spinner as clackSpinner,
  text as clackText,
  type Option
} from "@clack/prompts";

export interface PromptSelectOption<T = string> {
  value: T;
  label: string;
  hint?: string;
}

export interface PromptTextOptions {
  message: string;
  initialValue?: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
}

export interface PromptConfirmOptions {
  message: string;
  initialValue?: boolean;
}

export interface CliPrompter {
  intro(message: string): Promise<void>;
  outro(message: string): Promise<void>;
  note(message: string, title?: string): Promise<void>;
  select<T>(message: string, options: PromptSelectOption<T>[], initialValue?: T): Promise<T>;
  text(options: PromptTextOptions): Promise<string>;
  confirm(options: PromptConfirmOptions): Promise<boolean>;
  progress(initialMessage: string): { update(message: string): void; stop(message?: string): void };
}

export class PromptCancelledError extends Error {
  public constructor(message = "Prompt cancelled.") {
    super(message);
    this.name = "PromptCancelledError";
  }
}

interface CliPrompterParams {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

export function createCliPrompter(params: CliPrompterParams): CliPrompter {
  if (isTty(params.stdin) && isTty(params.stdout)) {
    return createClackPrompter();
  }

  return createReadlinePrompter(params);
}

function createClackPrompter(): CliPrompter {
  return {
    async intro(message) {
      clackIntro(message);
    },
    async outro(message) {
      clackOutro(message);
    },
    async note(message, title) {
      clackNote(message, title);
    },
    async select<T>(message: string, options: PromptSelectOption<T>[], initialValue?: T): Promise<T> {
      const mappedOptions = options.map((option) =>
        option.hint === undefined
          ? { value: option.value, label: option.label }
          : { value: option.value, label: option.label, hint: option.hint }
      ) as Option<T>[];

      const selected = await clackSelect({
        message,
        options: mappedOptions,
        initialValue
      });
      return guardCancelled(selected);
    },
    async text(options: PromptTextOptions): Promise<string> {
      const validate = options.required ? (input: string | undefined) => (input?.trim() ? undefined : "Value is required.") : undefined;
      const value = options.secret
        ? await clackPassword({
            message: options.message,
            validate
          })
        : await clackText({
            message: options.message,
            initialValue: options.initialValue,
            placeholder: options.placeholder,
            validate
          });

      return guardCancelled(value).trim();
    },
    async confirm(options: PromptConfirmOptions): Promise<boolean> {
      const value = await clackConfirm({
        message: options.message,
        initialValue: options.initialValue
      });

      return guardCancelled(value);
    },
    progress(initialMessage: string): { update(message: string): void; stop(message?: string): void } {
      const spin = clackSpinner();
      spin.start(initialMessage);
      return {
        update(message: string) {
          spin.message(message);
        },
        stop(message?: string) {
          spin.stop(message);
        }
      };
    }
  };
}

function createReadlinePrompter(params: CliPrompterParams): CliPrompter {
  return {
    async intro(message) {
      params.stdout.write(`${message}\n`);
    },
    async outro(message) {
      params.stdout.write(`${message}\n`);
    },
    async note(message, title) {
      if (title) {
        params.stdout.write(`${title}\n`);
      }
      params.stdout.write(`${message}\n`);
    },
    async select<T>(message: string, options: PromptSelectOption<T>[], initialValue?: T): Promise<T> {
      if (options.length === 0) {
        throw new Error("No options available.");
      }

      const initial = initialValue ?? options[0]?.value;
      const rl = createInterface({
        input: params.stdin,
        output: params.stdout
      });

      try {
        params.stdout.write(`${message}\n`);
        for (let index = 0; index < options.length; index += 1) {
          const option = options[index];
          if (!option) {
            continue;
          }
          const marker = option.value === initial ? " (default)" : "";
          const hint = option.hint ? ` - ${option.hint}` : "";
          params.stdout.write(`  ${index + 1}. ${option.label}${marker}${hint}\n`);
        }

        while (true) {
          const answer = (await rl.question("Select option by number: ")).trim();
          if (!answer && initial !== undefined) {
            return initial;
          }

          const asNumber = Number.parseInt(answer, 10);
          if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= options.length) {
            const selected = options[asNumber - 1];
            if (selected) {
              return selected.value;
            }
          }

          const byLabel = options.find((option) => option.label.toLowerCase() === answer.toLowerCase());
          if (byLabel) {
            return byLabel.value;
          }

          params.stderr.write("Invalid selection. Try again.\n");
        }
      } finally {
        rl.close();
      }
    },
    async text(options: PromptTextOptions): Promise<string> {
      const rl = createInterface({
        input: params.stdin,
        output: params.stdout
      });

      try {
        while (true) {
          const suffix = options.initialValue ? ` [${options.initialValue}]` : "";
          const answer = (await rl.question(`${options.message}${suffix}: `)).trim();
          const value = answer || options.initialValue || "";

          if (options.required && !value.trim()) {
            params.stderr.write("Value is required.\n");
            continue;
          }

          return value.trim();
        }
      } finally {
        rl.close();
      }
    },
    async confirm(options: PromptConfirmOptions): Promise<boolean> {
      const rl = createInterface({
        input: params.stdin,
        output: params.stdout
      });

      try {
        const defaultToken = options.initialValue ? "Y/n" : "y/N";
        const answer = (await rl.question(`${options.message} [${defaultToken}]: `)).trim().toLowerCase();
        if (!answer) {
          return Boolean(options.initialValue);
        }

        return answer === "y" || answer === "yes";
      } finally {
        rl.close();
      }
    },
    progress(initialMessage: string): { update(message: string): void; stop(message?: string): void } {
      params.stdout.write(`${initialMessage}\n`);
      return {
        update(message: string) {
          params.stdout.write(`${message}\n`);
        },
        stop(message?: string) {
          if (message) {
            params.stdout.write(`${message}\n`);
          }
        }
      };
    }
  };
}

function guardCancelled<T>(value: T | symbol): T {
  if (isCancel(value)) {
    clackCancel("Onboarding cancelled.");
    throw new PromptCancelledError();
  }
  return value;
}

function isTty(stream: NodeJS.ReadableStream | NodeJS.WritableStream): boolean {
  return Boolean((stream as { isTTY?: boolean }).isTTY);
}
