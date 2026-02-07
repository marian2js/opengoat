import { emitKeypressEvents } from "node:readline";
import { DEFAULT_AGENT_ID } from "@opengoat/core";
import type { OpenGoatService } from "@opengoat/core";
import type { ProviderOnboardingSpec, ProviderSummary } from "@opengoat/core";
import { resolveExtendedHttpProviderModelEnvVar } from "@opengoat/core";
import type { CliCommand } from "../framework/command.js";
import { resolveGuidedAuth, runGuidedAuth } from "./onboard-guided-auth.js";
import {
  createCliPrompter,
  PromptCancelledError,
  type CliPrompter
} from "../framework/prompter.js";

const PROVIDER_MODEL_ENV_KEY: Record<string, string> = {
  gemini: "GEMINI_MODEL",
  grok: "GROK_MODEL",
  openai: "OPENAI_MODEL",
  openclaw: "OPENGOAT_OPENCLAW_MODEL",
  opencode: "OPENCODE_MODEL",
  openrouter: "OPENROUTER_MODEL"
};

const PROVIDER_ORDER = [
  "openai",
  "anthropic",
  "grok",
  "openrouter",
  "google",
  "gemini",
  "amazon-bedrock",
  "azure-openai-responses",
  "groq",
  "mistral",
  "moonshot",
  "ollama",
  "claude",
  "codex",
  "cursor",
  "opencode",
  "openclaw"
] as const;

const providerPriorityById = new Map<string, number>(
  PROVIDER_ORDER.map((id, index) => [id, index])
);

type ProviderFamily = {
  id: string;
  label: string;
  hint?: string;
  providerIds: string[];
};

const ORGANIZED_PROVIDER_FAMILIES: Array<{
  id: string;
  label: string;
  hint?: string;
  providerIds: string[];
}> = [
  { id: "openai", label: "OpenAI", providerIds: ["openai", "openai-codex", "azure-openai-responses"] },
  { id: "anthropic", label: "Anthropic", providerIds: ["anthropic"] },
  { id: "minimax", label: "MiniMax", providerIds: ["minimax", "minimax-cn", "minimax-portal"] },
  { id: "moonshot", label: "Moonshot AI (Kimi)", providerIds: ["moonshot", "kimi-coding"] },
  {
    id: "google",
    label: "Google",
    providerIds: ["google", "google-antigravity", "google-gemini-cli", "google-vertex"]
  },
  { id: "openrouter", label: "OpenRouter", providerIds: ["openrouter"] },
  { id: "qwen", label: "Qwen", hint: "OAuth", providerIds: ["qwen-portal"] },
  { id: "zai", label: "Z.AI (GLM)", providerIds: ["zai"] },
  { id: "copilot", label: "Copilot", providerIds: ["github-copilot", "copilot-proxy"] },
  { id: "vercel", label: "Vercel AI Gateway", providerIds: ["vercel-ai-gateway"] },
  { id: "opencode", label: "OpenCode Zen", providerIds: ["opencode-zen"] },
  { id: "xiaomi", label: "Xiaomi", providerIds: ["xiaomi"] },
  { id: "synthetic", label: "Synthetic", providerIds: ["synthetic"] },
  { id: "venice", label: "Venice AI", providerIds: ["venice"] },
  { id: "cloudflare", label: "Cloudflare AI Gateway", providerIds: ["cloudflare-ai-gateway"] },
  { id: "groq", label: "Groq", providerIds: ["groq"] },
  { id: "mistral", label: "Mistral", providerIds: ["mistral"] },
  { id: "qianfan", label: "Qianfan", providerIds: ["qianfan"] },
  { id: "bedrock", label: "Amazon Bedrock", providerIds: ["amazon-bedrock"] },
  { id: "cerebras", label: "Cerebras", providerIds: ["cerebras"] },
  { id: "chutes", label: "Chutes", providerIds: ["chutes"] },
  { id: "huggingface", label: "Hugging Face", providerIds: ["huggingface"] },
  { id: "ollama", label: "Ollama", providerIds: ["ollama"] },
  { id: "cli-tools", label: "Local CLI tools", providerIds: ["claude", "codex", "cursor", "gemini", "opencode", "openclaw"] }
];

const PROVIDER_SETUP_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  "openai-codex": "https://platform.openai.com",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/app/apikey",
  "google-antigravity": "https://github.com/openclaw/google-antigravity-auth",
  "google-gemini-cli": "https://github.com/openclaw/google-gemini-cli-auth",
  grok: "https://console.x.ai",
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  moonshot: "https://platform.moonshot.ai",
  "kimi-coding": "https://platform.moonshot.ai",
  mistral: "https://console.mistral.ai/api-keys",
  cerebras: "https://cloud.cerebras.ai/platform",
  chutes: "https://chutes.ai/docs/sign-in-with-chutes/overview",
  huggingface: "https://huggingface.co/settings/tokens",
  minimax: "https://platform.minimax.io",
  "minimax-cn": "https://platform.minimax.io",
  "minimax-portal": "https://platform.minimax.io",
  "qwen-portal": "https://chat.qwen.ai",
  zai: "https://bigmodel.cn",
  qianfan: "https://cloud.baidu.com/product/wenxinworkshop",
  "vercel-ai-gateway": "https://vercel.com/dashboard/ai-gateway",
  "cloudflare-ai-gateway": "https://dash.cloudflare.com",
  "github-copilot": "https://github.com/features/copilot",
  "copilot-proxy": "https://github.com/openclaw/copilot-proxy",
  venice: "https://venice.ai",
  synthetic: "https://synthetic.new",
  xiaomi: "https://platform.xiaomi.com"
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
    const selectableProviders = sortProvidersForOnboarding(filterProvidersForOnboarding(agentId, providers));
    if (selectableProviders.length === 0) {
      context.stderr.write(`No eligible providers available for agent "${agentId}".\n`);
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
      let selectedProvider: ProviderSummary | null = null;
      let selectedEnvUpdates: Record<string, string> = {};
      let selectedShouldRunAuth = false;
      let preferredProviderId: string | undefined;

      while (!selectedProvider) {
        const providerId = await resolveProviderId({
          service: context.service,
          providers: selectableProviders,
          agentId,
          requestedProviderId: parsed.providerId,
          nonInteractive: parsed.nonInteractive,
          prompter,
          preferredProviderId
        });
        if (!providerId) {
          return 1;
        }

        const provider = selectableProviders.find((entry) => entry.id === providerId);
        if (!provider) {
          if (
            isDefaultAgent(agentId) &&
            providers.some((entry) => entry.id === providerId) &&
            !selectableProviders.some((entry) => entry.id === providerId)
          ) {
            context.stderr.write(
              `Provider "${providerId}" is not supported for orchestrator onboarding. ` +
                "Choose an internal provider.\n"
            );
            return 1;
          }
          context.stderr.write(`Unknown provider: ${providerId}\n`);
          return 1;
        }
        preferredProviderId = provider.id;

        const onboarding = (await context.service.getProviderOnboarding(provider.id)) ?? {};
        const existingConfig = await context.service.getProviderConfig(provider.id);
        const envUpdates = {
          ...(existingConfig?.env ?? {}),
          ...parsed.env
        };

        const guidedAuth = resolveGuidedAuth(provider.id);

        const modelEnvKey = resolveProviderModelEnvKey(provider.id, onboarding);
        if (parsed.model && modelEnvKey) {
          envUpdates[modelEnvKey] = parsed.model;
        }

        if (
          guidedAuth &&
          !parsed.nonInteractive &&
          !parsed.skipAuth &&
          (parsed.runAuth ||
            (await prompter.confirm({
              message: `${guidedAuth.title}: ${guidedAuth.description} Start guided sign-in now?`,
              initialValue: true
            })))
        ) {
          const authResult = await runGuidedAuth(provider.id, { prompter });
          Object.assign(envUpdates, authResult.env);
          if (authResult.note) {
            await prompter.note(authResult.note, guidedAuth.title);
          }
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
          const envAction = await promptForEnvValues({
            provider,
            onboarding,
            env: envUpdates,
            prompter,
            allowBack: !parsed.providerId,
            guidedAuthAvailable: Boolean(guidedAuth)
          });
          if (envAction === "back") {
            continue;
          }
        }

        const shouldRunAuth = await resolveRunAuth({
          parsed,
          provider,
          onboarding,
          prompter
        });

        selectedProvider = provider;
        selectedEnvUpdates = envUpdates;
        selectedShouldRunAuth = shouldRunAuth;
      }

      const provider = selectedProvider;
      const envUpdates = selectedEnvUpdates;
      const shouldRunAuth = selectedShouldRunAuth;

      await context.service.setAgentProvider(agentId, provider.id);

      if (Object.keys(envUpdates).length > 0) {
        await context.service.setProviderConfig(provider.id, envUpdates);
      }

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
  preferredProviderId?: string;
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
    if (currentProviderId && params.providers.some((provider) => provider.id === currentProviderId)) {
      return currentProviderId;
    }
    return params.providers[0]?.id ?? null;
  }

  const defaultProvider =
    params.preferredProviderId && params.providers.some((provider) => provider.id === params.preferredProviderId)
      ? params.preferredProviderId
      : currentProviderId && params.providers.some((provider) => provider.id === currentProviderId)
      ? currentProviderId
      : params.providers[0]?.id;
  const families = buildProviderFamilies(params.providers);
  const defaultFamilyId = resolveDefaultFamilyId(defaultProvider, families);

  const selectedFamilyId = await params.prompter.select(
    "Model/auth provider",
    families.map((family) => ({
      value: family.id,
      label: family.hint ? `${family.label} (${family.hint})` : family.label
    })),
    defaultFamilyId
  );
  const selectedFamily = families.find((family) => family.id === selectedFamilyId);
  if (!selectedFamily) {
    return null;
  }

  if (selectedFamily.providerIds.length === 1) {
    return selectedFamily.providerIds[0] ?? null;
  }

  const selectedProviderId = await params.prompter.select(
    `${selectedFamily.label} auth method`,
    selectedFamily.providerIds
      .map((id) => params.providers.find((provider) => provider.id === id))
      .filter((provider): provider is ProviderSummary => Boolean(provider))
      .map((provider) => ({
        value: provider.id,
        label: `${formatProviderDisplayName(provider)} (${provider.id})`,
        hint: resolveGuidedAuth(provider.id)?.description
      })),
    defaultProvider && selectedFamily.providerIds.includes(defaultProvider)
      ? defaultProvider
      : selectedFamily.providerIds[0]
  );

  return selectedProviderId || null;
}

async function promptForEnvValues(params: {
  provider: ProviderSummary;
  onboarding: ProviderOnboardingSpec;
  env: Record<string, string>;
  prompter: CliPrompter;
  allowBack: boolean;
  guidedAuthAvailable: boolean;
}): Promise<"continue" | "back"> {
  const fields = (params.onboarding.env ?? []).filter((field) => Boolean(field.required));
  if (fields.length === 0) {
    return "continue";
  }

  await params.prompter.note(
    `Configure required settings for provider "${params.provider.id}".`,
    "Provider Setup"
  );

  for (const field of fields) {
    const existing = params.env[field.key] ?? process.env[field.key]?.trim();
    if (existing) {
      params.env[field.key] = existing;
      continue;
    }

    if (params.allowBack) {
      const response = await promptTextOrBack({
        prompter: params.prompter,
        message: formatEnvPromptMessage(params.provider.id, field, params.guidedAuthAvailable),
        initialValue: field.secret ? undefined : existing,
        existingValue: existing,
        required: true,
        secret: Boolean(field.secret)
      });
      if (response.action === "back") {
        return "back";
      }
      params.env[field.key] = response.value;
      continue;
    }

    const value = await params.prompter.text({
      message: formatEnvPromptMessage(params.provider.id, field, params.guidedAuthAvailable),
      initialValue: field.secret ? undefined : existing,
      required: true,
      secret: Boolean(field.secret)
    });
    params.env[field.key] = value;
  }

  return "continue";
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

function filterProvidersForOnboarding(agentId: string, providers: ProviderSummary[]): ProviderSummary[] {
  if (!isDefaultAgent(agentId)) {
    return providers;
  }

  return providers.filter((provider) => provider.kind === "http");
}

function sortProvidersForOnboarding(providers: ProviderSummary[]): ProviderSummary[] {
  return providers.slice().sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "http" ? -1 : 1;
    }

    const leftPriority = providerPriorityById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = providerPriorityById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const byName = left.displayName.localeCompare(right.displayName);
    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id);
  });
}

function isDefaultAgent(agentId: string): boolean {
  return agentId.trim().toLowerCase() === DEFAULT_AGENT_ID;
}

function formatProviderDisplayName(provider: ProviderSummary): string {
  return provider.displayName;
}

function buildProviderFamilies(providers: ProviderSummary[]): ProviderFamily[] {
  const providerById = new Map(providers.map((provider) => [provider.id, provider] as const));
  const families: ProviderFamily[] = [];
  const usedProviderIds = new Set<string>();

  for (const family of ORGANIZED_PROVIDER_FAMILIES) {
    const presentIds = family.providerIds.filter((id) => providerById.has(id));
    if (presentIds.length === 0) {
      continue;
    }
    presentIds.forEach((id) => usedProviderIds.add(id));
    families.push({
      id: family.id,
      label: family.label,
      hint: family.hint,
      providerIds: presentIds
    });
  }

  const leftovers = providers
    .filter((provider) => !usedProviderIds.has(provider.id))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  for (const provider of leftovers) {
    families.push({
      id: `provider:${provider.id}`,
      label: provider.displayName,
      providerIds: [provider.id]
    });
  }

  return families;
}

function resolveDefaultFamilyId(defaultProviderId: string | undefined, families: ProviderFamily[]): string | undefined {
  if (!defaultProviderId) {
    return families[0]?.id;
  }
  return families.find((family) => family.providerIds.includes(defaultProviderId))?.id ?? families[0]?.id;
}

function formatEnvPromptMessage(
  providerId: string,
  field: { key: string; description: string },
  guidedAuthAvailable: boolean
): string {
  const base = `${field.description} (${field.key})`;
  const lines = [base];

  const setupUrl = PROVIDER_SETUP_URLS[providerId];
  if (setupUrl) {
    lines.push(`Get credentials: ${setupUrl}`);
  }

  if (guidedAuthAvailable && /OAUTH|TOKEN/i.test(field.key)) {
    lines.push("Tip: guided sign-in can fill this automatically.");
  }

  return lines.join("\n");
}

function isBackCommand(value: string): boolean {
  return value.trim().toLowerCase() === ":back";
}

async function promptTextOrBack(params: {
  prompter: CliPrompter;
  message: string;
  initialValue?: string;
  existingValue?: string;
  required: boolean;
  secret: boolean;
}): Promise<{ action: "submit"; value: string } | { action: "back" }> {
  const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean; setRawMode?: (mode: boolean) => void };
  const stdout = process.stdout as NodeJS.WriteStream & { isTTY?: boolean };
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    const fallbackValue = await params.prompter.text({
      message: `${params.message} [type :back to provider list]`,
      initialValue: params.initialValue,
      required: params.required,
      secret: params.secret
    });
    if (isBackCommand(fallbackValue)) {
      return { action: "back" };
    }
    return { action: "submit", value: fallbackValue.trim() };
  }

  return await new Promise<{ action: "submit"; value: string } | { action: "back" }>((resolve, reject) => {
    type Focus = "input" | "back";
    const existingValue = params.existingValue?.trim() || "";
    const preserveExistingOnEmpty = existingValue.length > 0;
    let value = params.initialValue ?? "";
    let focus: Focus = "input";
    let error = "";
    let renderedLines = 0;
    const originalRawMode = Boolean((stdin as NodeJS.ReadStream & { isRaw?: boolean }).isRaw);
    const toVisualLines = (rawLines: string[]): string[] =>
      rawLines.flatMap((line) => {
        const parts = line.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        return parts.length > 0 ? parts : [""];
      });

    const clearRenderedLines = () => {
      if (renderedLines <= 0) {
        return;
      }
      stdout.write(`\x1B[${renderedLines}A`);
      for (let index = 0; index < renderedLines; index += 1) {
        stdout.write("\x1B[2K\r");
        if (index < renderedLines - 1) {
          stdout.write("\x1B[1B");
        }
      }
      if (renderedLines > 1) {
        stdout.write(`\x1B[${renderedLines - 1}A`);
      }
      stdout.write("\r");
      renderedLines = 0;
    };

    const cleanup = () => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode?.(originalRawMode);
      stdout.write("\x1B[?25h");
      clearRenderedLines();
    };

    const render = () => {
      const displayValue = params.secret ? "•".repeat(value.length) : value;
      const hasExistingValue = preserveExistingOnEmpty;
      const keepCurrentHint = hasExistingValue ? "Press Enter to keep current value." : "";
      const inputHint = params.required
        ? "Type a value and press Enter."
        : "Type a value and press Enter, or leave empty to skip.";
      const helperText = [inputHint, keepCurrentHint].filter(Boolean).join(" ");
      const caret = focus === "input" ? "█" : "";
      const valueSuffix = `${displayValue}${caret}`;
      const inputPrefix = focus === "input" ? "›" : " ";
      const inputLabel = focus === "input" ? "Value" : "Value";
      const logicalLines = [
        params.message,
        `${inputPrefix} ${inputLabel}: ${valueSuffix}`,
        `  ${helperText}`,
        `${focus === "back" ? "●" : "○"} ← Back to provider list`,
        ...(error ? [error] : [])
      ];
      const lines = toVisualLines(logicalLines);

      if (renderedLines > 0) {
        stdout.write(`\x1B[${renderedLines}A`);
      }

      const totalLines = Math.max(renderedLines, lines.length);
      for (let index = 0; index < totalLines; index += 1) {
        const line = lines[index] ?? "";
        stdout.write("\x1B[2K\r");
        stdout.write(line);
        stdout.write("\n");
      }
      renderedLines = lines.length;
    };

    const submitInput = () => {
      const trimmed = value.trim();
      if (!trimmed && preserveExistingOnEmpty) {
        cleanup();
        resolve({ action: "submit", value: existingValue });
        return;
      }
      if (params.required && !trimmed) {
        error = "Value is required.";
        render();
        return;
      }
      cleanup();
      resolve({ action: "submit", value: trimmed });
    };

    const onKeypress = (chunk: string, key: { name?: string; ctrl?: boolean; meta?: boolean; sequence?: string }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new PromptCancelledError());
        return;
      }

      if (key.name === "down") {
        focus = "back";
        error = "";
        render();
        return;
      }

      if (key.name === "up") {
        focus = "input";
        error = "";
        render();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        if (focus === "back") {
          cleanup();
          resolve({ action: "back" });
          return;
        }
        submitInput();
        return;
      }

      if (focus !== "input") {
        return;
      }

      if (key.name === "backspace" || key.name === "delete") {
        value = value.slice(0, -1);
        error = "";
        render();
        return;
      }

      const sequence = key.sequence ?? chunk;
      if (!sequence || key.ctrl || key.meta) {
        return;
      }
      if (sequence.length === 1 && sequence >= " ") {
        value += sequence;
        error = "";
        render();
      }
    };

    emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdout.write("\x1B[?25l");
    stdin.on("keypress", onKeypress);
    render();
  });
}

function resolveProviderModelEnvKey(providerId: string, onboarding: ProviderOnboardingSpec): string | undefined {
  const candidate = (onboarding.env ?? [])
    .map((field) => field.key.trim())
    .find((key) => /_MODEL$/.test(key));
  if (candidate) {
    return candidate;
  }

  return PROVIDER_MODEL_ENV_KEY[providerId] ?? resolveExtendedHttpProviderModelEnvVar(providerId);
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
  output.write("  - On first run, this bootstraps ~/.opengoat automatically.\n");
  output.write("  - Providers are auto-discovered from provider folders.\n");
  output.write("  - Orchestrator onboarding only allows internal providers.\n");
  output.write("  - Interactive mode supports arrow-key selection.\n");
  output.write(`  - Agent defaults to ${DEFAULT_AGENT_ID}.\n`);
  output.write("  - Provider settings are stored in ~/.opengoat/providers/<provider>/config.json.\n");
}
