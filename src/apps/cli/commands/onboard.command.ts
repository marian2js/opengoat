import { createInterface } from "node:readline/promises";
import type { OpenGoatService } from "../../../core/opengoat/index.js";
import type { ProviderOnboardingSpec, ProviderSummary } from "../../../core/providers/index.js";
import type { CliCommand } from "../framework/command.js";

const DEFAULT_AGENT_ID = "orchestrator";

const PROVIDER_MODEL_ENV_KEY: Record<string, string> = {
  openai: "OPENGOAT_OPENAI_MODEL",
  openrouter: "OPENGOAT_OPENROUTER_MODEL",
  grok: "OPENGOAT_GROK_MODEL"
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

    const providerId = await resolveProviderId({
      service: context.service,
      providers,
      agentId,
      requestedProviderId: parsed.providerId,
      nonInteractive: parsed.nonInteractive,
      stdin: process.stdin,
      stdout: process.stdout
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
        stdin: process.stdin,
        stdout: process.stdout
      });
    }

    if (Object.keys(envUpdates).length > 0) {
      await context.service.setProviderConfig(provider.id, envUpdates);
    }

    const shouldRunAuth = await resolveRunAuth({
      parsed,
      provider,
      onboarding,
      stdin: process.stdin,
      stdout: process.stdout
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

    context.stdout.write("Onboarding complete.\n");
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
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
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

  const rl = createInterface({
    input: params.stdin,
    output: params.stdout
  });

  try {
    params.stdout.write("\nAvailable providers:\n");
    for (let index = 0; index < params.providers.length; index += 1) {
      const provider = params.providers[index];
      if (!provider) {
        continue;
      }
      const marker = provider.id === currentProviderId ? " (current)" : "";
      params.stdout.write(`  ${index + 1}. ${provider.id}${marker}\n`);
    }

    const defaultProvider =
      currentProviderId && params.providers.some((provider) => provider.id === currentProviderId)
        ? currentProviderId
        : params.providers[0]?.id;

    const answer = await rl.question(`Select provider [${defaultProvider}]: `);
    const input = answer.trim();

    if (!input) {
      return defaultProvider ?? null;
    }

    const asNumber = Number.parseInt(input, 10);
    if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= params.providers.length) {
      return params.providers[asNumber - 1]?.id ?? null;
    }

    const byId = params.providers.find((provider) => provider.id === input.toLowerCase());
    return byId?.id ?? null;
  } finally {
    rl.close();
  }
}

async function promptForEnvValues(params: {
  provider: ProviderSummary;
  onboarding: ProviderOnboardingSpec;
  env: Record<string, string>;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
}): Promise<void> {
  const fields = params.onboarding.env ?? [];
  if (fields.length === 0) {
    return;
  }

  const rl = createInterface({
    input: params.stdin,
    output: params.stdout
  });

  try {
    params.stdout.write(`\nProvider settings for ${params.provider.id}:\n`);

    for (const field of fields) {
      const existing = params.env[field.key] ?? process.env[field.key]?.trim();
      const requiredLabel = field.required ? " (required)" : " (optional)";
      const defaultLabel = existing ? " [already set]" : "";
      const prompt = `${field.description}${requiredLabel}${defaultLabel}: `;

      if (existing && !field.required) {
        continue;
      }

      const answer = (await rl.question(prompt)).trim();
      if (answer) {
        params.env[field.key] = answer;
      } else if (existing) {
        params.env[field.key] = existing;
      }
    }
  } finally {
    rl.close();
  }
}

async function resolveRunAuth(params: {
  parsed: Extract<ParsedOnboardArgs, { ok: true }>;
  provider: ProviderSummary;
  onboarding: ProviderOnboardingSpec;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
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

  const rl = createInterface({
    input: params.stdin,
    output: params.stdout
  });
  try {
    const answer = (await rl.question(`Run provider auth now? (${auth.description}) [y/N]: `))
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
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
  output.write("  - Agent defaults to orchestrator.\n");
  output.write("  - Provider settings are stored in ~/.opengoat/providers/<provider>/config.json.\n");
}
