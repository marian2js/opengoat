import { DEFAULT_AGENT_ID } from "../../../core/domain/agent-id.js";
import type { OpenGoatService } from "../../../core/opengoat/index.js";
import type { ProviderOnboardingSpec, ProviderSummary } from "../../../core/providers/index.js";
import type { CliCommand } from "../framework/command.js";
import {
  createCliPrompter,
  PromptCancelledError,
  type CliPrompter
} from "../framework/prompter.js";

const PROVIDER_MODEL_ENV_KEY: Record<string, string> = {
  gemini: "GEMINI_MODEL",
  opencode: "OPENCODE_MODEL",
  openai: "OPENAI_MODEL",
  openrouter: "OPENROUTER_MODEL",
  grok: "GROK_MODEL"
};

export const onboardCommand: CliCommand = {
  path: ["onboard"],
  description: "Onboard an agent/provider and configure credentials.",
  async run(args, context): Promise<number> {
    const parsed = parseOnboardArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    await context.service.initialize();

    const agentId = parsed.agentId ?? DEFAULT_AGENT_ID;
    const providers = await context.service.listProviders();
    if (providers.length === 0) {
      context.stderr.write("No providers discovered.\n");
      return 1;
    }

    const prompter = createCliPrompter({
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    });
    const interactive = !parsed.nonInteractive;

    if (interactive) {
      await prompter.intro("OpenGoat Onboarding");
      await prompter.note(`Agent: ${agentId}`, "Setup");
      await prompter.note("Use arrow keys to move and Enter to select.", "Controls");
    }

    try {
      const providerId = await resolveProviderId({
        service: context.service,
        providers,
        agentId,
        requestedProviderId: parsed.providerId,
        nonInteractive: parsed.nonInteractive,
        prompter
      });
      if (!providerId) {
        return 1;
      }

      const provider = providers.find((entry) => entry.id === providerId);
      if (!provider) {
        context.stderr.write(`Unknown provider: ${providerId}\n`);
        return 1;
      }

      await context.service.setAgentProvider(agentId, provider.id);

      const onboarding = (await context.service.getProviderOnboarding(provider.id)) ?? {};
      const existingConfig = await context.service.getProviderConfig(provider.id);
      const envUpdates = {
        ...(existingConfig?.env ?? {}),
        ...parsed.env
      };

      const modelEnvKey = PROVIDER_MODEL_ENV_KEY[provider.id];
      if (parsed.model && modelEnvKey) {
        envUpdates[modelEnvKey] = parsed.model;
      }

      if (parsed.nonInteractive) {
        const missing = findMissingRequiredEnv(envUpdates, onboarding, process.env);
        if (missing.length > 0) {
          context.stderr.write(
            `Missing required provider settings for ${provider.id}: ${missing.join(", ")}\n`
          );
          context.stderr.write("Provide values with --env KEY=VALUE or provider-specific key flags.\n");
          return 1;
        }
      } else {
        await promptForEnvValues({
          provider,
          onboarding,
          env: envUpdates,
          prompter
        });
      }

      if (Object.keys(envUpdates).length > 0) {
        await context.service.setProviderConfig(provider.id, envUpdates);
      }

      const shouldRunAuth = await resolveRunAuth({
        parsed,
        provider,
        onboarding,
        prompter
      });

      if (shouldRunAuth) {
        const authResult = await context.service.authenticateProvider(provider.id, {
          env: process.env,
          onStdout: (chunk) => {
            context.stdout.write(chunk);
          },
          onStderr: (chunk) => {
            context.stderr.write(chunk);
          }
        });

        if (authResult.code !== 0) {
          context.stderr.write(`Provider auth failed for ${provider.id}.\n`);
          return authResult.code;
        }
      }

      if (interactive) {
        await prompter.outro("Onboarding complete.");
      } else {
        context.stdout.write("Onboarding complete.\n");
      }
      context.stdout.write(`Agent: ${agentId}\n`);
      context.stdout.write(`Provider: ${provider.id}\n`);
      if (Object.keys(envUpdates).length > 0) {
        context.stdout.write(
          `Saved provider config: ${context.service.getPaths().providersDir}/${provider.id}/config.json\n`
        );
      }
      if (shouldRunAuth) {
        context.stdout.write("Provider auth flow completed.\n");
      }

      return 0;
    } catch (error) {
      if (error instanceof PromptCancelledError) {
        return 0;
      }
      throw error;
    }
  }
};

type ParsedOnboardArgs =
  | {
      ok: true;
      help: boolean;
      nonInteractive: boolean;
      runAuth?: boolean;
      skipAuth?: boolean;
      providerId?: string;
      agentId?: string;
      model?: string;
      env: Record<string, string>;
    }
  | {
      ok: false;
      error: string;
    };

function parseOnboardArgs(args: string[]): ParsedOnboardArgs {
  let nonInteractive = false;
  let help = false;
  let runAuth = false;
  let skipAuth = false;
  let providerId: string | undefined;
  let agentId: string | undefined;
  let model: string | undefined;
  const env: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }

    if (token === "--non-interactive") {
      nonInteractive = true;
      continue;
    }

    if (token === "--run-auth") {
      runAuth = true;
      continue;
    }

    if (token === "--skip-auth") {
      skipAuth = true;
      continue;
    }

    if (token === "--provider") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --provider." };
      }
      providerId = value.toLowerCase();
      index += 1;
      continue;
    }

    if (token === "--agent") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --agent." };
      }
      agentId = value.toLowerCase();
      index += 1;
      continue;
    }

    if (token === "--model") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --model." };
      }
      model = value;
      index += 1;
      continue;
    }

    if (token === "--openai-api-key") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --openai-api-key." };
      }
      env.OPENAI_API_KEY = value;
      index += 1;
      continue;
    }

    if (token === "--openrouter-api-key") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --openrouter-api-key." };
      }
      env.OPENROUTER_API_KEY = value;
      index += 1;
      continue;
    }

    if (token === "--xai-api-key") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --xai-api-key." };
      }
      env.XAI_API_KEY = value;
      index += 1;
      continue;
    }

    if (token === "--env") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --env." };
      }
      const parsed = parseEnvPair(value);
      if (!parsed) {
        return { ok: false, error: `Invalid --env entry: ${value}` };
      }
      env[parsed.key] = parsed.value;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (runAuth && skipAuth) {
    return { ok: false, error: "Use either --run-auth or --skip-auth, not both." };
  }

  return {
    ok: true,
    help,
    nonInteractive,
    runAuth: runAuth || undefined,
    skipAuth: skipAuth || undefined,
    providerId,
    agentId,
    model,
    env
  };
}

async function resolveProviderId(params: {
  service: OpenGoatService;
  providers: ProviderSummary[];
  agentId: string;
  requestedProviderId?: string;
  nonInteractive: boolean;
  prompter: CliPrompter;
}): Promise<string | null> {
  if (params.requestedProviderId) {
    return params.requestedProviderId;
  }

  let currentProviderId: string | undefined;
  try {
    const current = await params.service.getAgentProvider(params.agentId);
    currentProviderId = current.providerId;
  } catch {
    currentProviderId = undefined;
  }

  if (params.nonInteractive) {
    return currentProviderId ?? "codex";
  }

  const defaultProvider =
    currentProviderId && params.providers.some((provider) => provider.id === currentProviderId)
      ? currentProviderId
      : params.providers[0]?.id;

  const selected = await params.prompter.select(
    "Choose a provider",
    params.providers.map((provider) => ({
      value: provider.id,
      label: `${provider.displayName} (${provider.id})`,
      hint: provider.id === currentProviderId ? "current" : provider.kind
    })),
    defaultProvider
  );

  return selected || null;
}

async function promptForEnvValues(params: {
  provider: ProviderSummary;
  onboarding: ProviderOnboardingSpec;
  env: Record<string, string>;
  prompter: CliPrompter;
}): Promise<void> {
  const fields = params.onboarding.env ?? [];
  if (fields.length === 0) {
    return;
  }

  await params.prompter.note(`Configure settings for provider "${params.provider.id}".`, "Provider Setup");

  for (const field of fields) {
    const existing = params.env[field.key] ?? process.env[field.key]?.trim();
    if (existing) {
      const keepExisting = await params.prompter.confirm({
        message: `Keep existing ${field.key}?`,
        initialValue: true
      });
      if (keepExisting) {
        params.env[field.key] = existing;
        continue;
      }
    }

    const value = await params.prompter.text({
      message: `${field.description} (${field.key})`,
      initialValue: field.secret ? undefined : existing,
      placeholder: field.required ? undefined : "Leave empty to skip",
      required: Boolean(field.required),
      secret: Boolean(field.secret)
    });

    if (value) {
      params.env[field.key] = value;
      continue;
    }

    if (!field.required) {
      delete params.env[field.key];
    }
  }
}

async function resolveRunAuth(params: {
  parsed: Extract<ParsedOnboardArgs, { ok: true }>;
  provider: ProviderSummary;
  onboarding: ProviderOnboardingSpec;
  prompter: CliPrompter;
}): Promise<boolean> {
  if (params.parsed.skipAuth) {
    return false;
  }
  if (params.parsed.runAuth) {
    return true;
  }

  const auth = params.onboarding.auth;
  if (!auth?.supported || !params.provider.capabilities.auth || params.parsed.nonInteractive) {
    return false;
  }

  return params.prompter.confirm({
    message: `Run provider auth now? ${auth.description}`,
    initialValue: false
  });
}

function findMissingRequiredEnv(
  configured: Record<string, string>,
  onboarding: ProviderOnboardingSpec,
  runtimeEnv: NodeJS.ProcessEnv
): string[] {
  const fields = onboarding.env ?? [];
  const missing: string[] = [];
  for (const field of fields) {
    if (!field.required) {
      continue;
    }
    const value = configured[field.key] ?? runtimeEnv[field.key]?.trim();
    if (!value) {
      missing.push(field.key);
    }
  }
  return missing;
}

function parseEnvPair(raw: string): { key: string; value: string } | null {
  const separator = raw.indexOf("=");
  if (separator <= 0) {
    return null;
  }

  const key = raw.slice(0, separator).trim();
  const value = raw.slice(separator + 1).trim();
  if (!key || !value) {
    return null;
  }

  return { key, value };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat onboard [--agent <id>] [--provider <id>] [--non-interactive] [--run-auth|--skip-auth]\n"
  );
  output.write("                  [--model <id>] [--env KEY=VALUE]...\n");
  output.write("                  [--openai-api-key <key>] [--openrouter-api-key <key>] [--xai-api-key <key>]\n");
  output.write("\n");
  output.write("Notes:\n");
  output.write("  - Providers are auto-discovered from provider folders.\n");
  output.write("  - Interactive mode supports arrow-key selection.\n");
  output.write(`  - Agent defaults to ${DEFAULT_AGENT_ID}.\n`);
  output.write("  - Provider settings are stored in ~/.opengoat/providers/<provider>/config.json.\n");
}
