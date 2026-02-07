import { useEffect, useMemo, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import type { WorkbenchOnboarding } from "@shared/workbench";

interface OnboardingPanelProps {
  onboarding: WorkbenchOnboarding;
  providerId: string;
  env: Record<string, string>;
  error: string | null;
  canClose: boolean;
  isSubmitting: boolean;
  onSelectProvider: (providerId: string) => void;
  onEnvChange: (key: string, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

type OnboardingStep = "provider" | "setup";

export function OnboardingPanel(props: OnboardingPanelProps) {
  const [step, setStep] = useState<OnboardingStep>("provider");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const selectedProvider = resolveSelectedOnboardingProvider(
    props.onboarding,
    props.providerId
  );
  const providerGroups = useMemo(
    () => splitProviderGroups(props.onboarding),
    [props.onboarding]
  );
  const envPartition = useMemo(
    () => splitEnvFields(selectedProvider?.envFields ?? []),
    [selectedProvider]
  );
  const missingRequiredKeys = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }
    return envPartition.required
      .filter((field) => {
        const configured = selectedProvider.configuredEnvKeys.includes(field.key);
        const value = props.env[field.key] ?? "";
        return !isFieldSatisfied({
          required: field.required === true,
          configured,
          value
        });
      })
      .map((field) => field.key);
  }, [envPartition.required, props.env, selectedProvider]);

  useEffect(() => {
    if (props.isSubmitting) {
      return;
    }
    if (!selectedProvider) {
      setStep("provider");
    }
  }, [props.isSubmitting, selectedProvider]);

  const missingSummary =
    missingRequiredKeys.length > 0 ? `Missing required fields: ${missingRequiredKeys.join(", ")}` : null;
  const canContinue = Boolean(selectedProvider);
  const canSubmit =
    Boolean(selectedProvider) &&
    missingRequiredKeys.length === 0 &&
    !props.isSubmitting;

  return (
    <div className="flex h-screen items-center justify-center bg-[radial-gradient(1200px_500px_at_10%_-20%,_rgba(22,163,74,0.16),transparent_55%),radial-gradient(900px_450px_at_100%_0%,_rgba(245,158,11,0.15),transparent_55%),var(--background)] px-4 py-8 text-[var(--foreground)] md:px-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,black)] shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
        <header className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-strong)_86%,black)] px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-heading text-3xl tracking-tight">OpenGoat Setup</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {step === "provider"
                  ? "Pick how the orchestrator should run."
                  : "Add required credentials. Keep advanced settings optional."}
              </p>
            </div>
            <StepPills step={step} />
          </div>
        </header>

        <div className="px-6 py-6 md:px-8 md:py-7">
          {step === "provider" ? (
            <ProviderStep
              providerId={props.providerId}
              groups={providerGroups}
              onSelectProvider={props.onSelectProvider}
              disabled={props.isSubmitting}
            />
          ) : (
            <SetupStep
              provider={selectedProvider}
              env={props.env}
              requiredFields={envPartition.required}
              optionalFields={envPartition.optional}
              showAdvanced={showAdvanced}
              missingRequiredKeys={missingRequiredKeys}
              disabled={props.isSubmitting}
              onToggleAdvanced={() => setShowAdvanced((current) => !current)}
              onEnvChange={props.onEnvChange}
            />
          )}

          {missingSummary ? (
            <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              {missingSummary}
            </div>
          ) : null}

          {props.error ? (
            <div className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {props.error}
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,black)] px-6 py-4 md:px-8">
          <div className="text-xs text-[var(--muted-foreground)]">
            {selectedProvider
              ? `${selectedProvider.displayName} (${selectedProvider.id})`
              : "Choose a provider to continue"}
          </div>
          <div className="flex items-center gap-2">
            {step === "setup" ? (
              <Button
                variant="outline"
                onClick={() => setStep("provider")}
                disabled={props.isSubmitting}
              >
                Back
              </Button>
            ) : null}
            {props.canClose ? (
              <Button
                variant="outline"
                onClick={props.onClose}
                disabled={props.isSubmitting}
              >
                Close
              </Button>
            ) : null}
            {step === "provider" ? (
              <Button
                onClick={() => setStep("setup")}
                disabled={!canContinue || props.isSubmitting}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={props.onSubmit}
                disabled={!canSubmit}
              >
                {props.isSubmitting ? "Saving..." : "Save and Start"}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function ProviderStep(props: {
  providerId: string;
  groups: {
    api: WorkbenchOnboarding["providers"];
    local: WorkbenchOnboarding["providers"];
  };
  disabled: boolean;
  onSelectProvider: (providerId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <ProviderGroup
        title="Cloud APIs"
        subtitle="Use API keys with OpenAI-compatible or hosted providers."
        providers={props.groups.api}
        selectedProviderId={props.providerId}
        disabled={props.disabled}
        onSelectProvider={props.onSelectProvider}
      />
      <ProviderGroup
        title="Local Tools"
        subtitle="Use installed CLIs like Codex, Claude, Cursor, OpenCode, or OpenClaw."
        providers={props.groups.local}
        selectedProviderId={props.providerId}
        disabled={props.disabled}
        onSelectProvider={props.onSelectProvider}
      />
    </div>
  );
}

function ProviderGroup(props: {
  title: string;
  subtitle: string;
  providers: WorkbenchOnboarding["providers"];
  selectedProviderId: string;
  disabled: boolean;
  onSelectProvider: (providerId: string) => void;
}) {
  if (props.providers.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {props.title}
        </p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{props.subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {props.providers.map((provider) => {
          const isSelected = provider.id === props.selectedProviderId;
          const requiredCount = provider.envFields.filter((field) => field.required).length;
          const missingRequiredCount = provider.missingRequiredEnv.length;
          return (
            <button
              key={provider.id}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onSelectProvider(provider.id)}
              className={`rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] shadow-[0_0_0_1px_var(--accent)]"
                  : "border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_95%,black)] hover:border-[var(--accent)]/70 hover:bg-[color-mix(in_oklab,var(--surface-strong)_75%,black)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading text-lg">{provider.displayName}</p>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  {provider.kind}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {buildProviderDescription(provider.id)}
              </p>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {requiredCount > 0
                  ? `${requiredCount} required field${requiredCount === 1 ? "" : "s"}`
                  : "No required fields"}
                {missingRequiredCount > 0 ? ` • ${missingRequiredCount} missing` : ""}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SetupStep(props: {
  provider: WorkbenchOnboarding["providers"][number] | null;
  env: Record<string, string>;
  requiredFields: Array<{
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  }>;
  optionalFields: Array<{
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  }>;
  showAdvanced: boolean;
  missingRequiredKeys: string[];
  disabled: boolean;
  onToggleAdvanced: () => void;
  onEnvChange: (key: string, value: string) => void;
}) {
  if (!props.provider) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)]">
        Select a provider to configure setup.
      </div>
    );
  }

  const provider = props.provider;
  const hasRequired = props.requiredFields.length > 0;
  const hasOptional = props.optionalFields.length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,black)] px-4 py-3">
        <p className="font-heading text-lg">{provider.displayName} Setup</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Quick setup first. Advanced fields are optional and hidden by default.
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Quick Setup
        </p>
        {!hasRequired ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
            No required credentials for this provider.
          </div>
        ) : (
          props.requiredFields.map((field) => {
            const configured = provider.configuredEnvKeys.includes(field.key);
            const value = props.env[field.key] ?? "";
            const missing = props.missingRequiredKeys.includes(field.key);
            return (
              <EnvFieldInput
                key={field.key}
                field={field}
                value={value}
                configured={configured}
                missing={missing}
                disabled={props.disabled}
                onChange={props.onEnvChange}
              />
            );
          })
        )}
      </section>

      {hasOptional ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={props.onToggleAdvanced}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm font-medium"
          >
            {props.showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
          </button>
          {props.showAdvanced ? (
            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_95%,black)] p-4">
              {props.optionalFields.map((field) => {
                const configured = provider.configuredEnvKeys.includes(field.key);
                const value = props.env[field.key] ?? "";
                return (
                  <EnvFieldInput
                    key={field.key}
                    field={field}
                    value={value}
                    configured={configured}
                    missing={false}
                    disabled={props.disabled}
                    onChange={props.onEnvChange}
                  />
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function EnvFieldInput(props: {
  field: {
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  };
  value: string;
  configured: boolean;
  missing: boolean;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{toHumanLabel(props.field.key)}</p>
        {props.field.required ? (
          <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
            Required
          </span>
        ) : null}
      </div>
      <Input
        type={props.field.secret ? "password" : "text"}
        value={props.value}
        onChange={(event) => {
          props.onChange(props.field.key, event.target.value);
        }}
        placeholder={props.field.description}
        disabled={props.disabled}
      />
      <p className={`text-xs ${props.missing ? "text-amber-300" : "text-[var(--muted-foreground)]"}`}>
        {props.field.description}
        {props.configured && !props.value ? " (currently configured)" : ""}
      </p>
    </div>
  );
}

function StepPills(props: { step: OnboardingStep }) {
  const isProviderStep = props.step === "provider";
  const isSetupStep = props.step === "setup";

  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em]">
      <span
        className={`rounded-full px-3 py-1 ${
          isProviderStep
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]"
        }`}
      >
        1 Provider
      </span>
      <span
        className={`rounded-full px-3 py-1 ${
          isSetupStep
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]"
        }`}
      >
        2 Setup
      </span>
    </div>
  );
}

function resolveSelectedOnboardingProvider(
  onboarding: WorkbenchOnboarding,
  selectedProviderId: string
) {
  const selected = selectedProviderId.trim();
  if (selected) {
    const found = onboarding.providers.find((provider) => provider.id === selected);
    if (found) {
      return found;
    }
  }
  return onboarding.providers[0] ?? null;
}

function splitProviderGroups(onboarding: WorkbenchOnboarding) {
  return onboarding.providers.reduce(
    (groups, provider) => {
      if (provider.kind === "http") {
        groups.api.push(provider);
      } else {
        groups.local.push(provider);
      }
      return groups;
    },
    {
      api: [] as WorkbenchOnboarding["providers"],
      local: [] as WorkbenchOnboarding["providers"]
    }
  );
}

function splitEnvFields(
  fields: Array<{
    key: string;
    description: string;
    required?: boolean;
    secret?: boolean;
  }>
) {
  const required: typeof fields = [];
  const optional: typeof fields = [];
  for (const field of fields) {
    if (field.required) {
      required.push(field);
      continue;
    }
    optional.push(field);
  }
  return { required, optional };
}

function isFieldSatisfied(params: {
  required: boolean;
  configured: boolean;
  value: string;
}): boolean {
  if (!params.required) {
    return true;
  }
  return params.configured || Boolean(params.value.trim());
}

function toHumanLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join("_");
}

function buildProviderDescription(providerId: string): string {
  const descriptions: Record<string, string> = {
    codex: "Run OpenAI Codex CLI locally.",
    claude: "Use Anthropic Claude Code from your machine.",
    cursor: "Route through Cursor Agent CLI.",
    opencode: "Use OpenCode CLI sessions and models.",
    openclaw: "Use OpenClaw CLI orchestration.",
    openai: "Use OpenAI-compatible APIs with optional base URL.",
    gemini: "Use Gemini CLI or API credentials.",
    grok: "Use xAI Grok API with API key auth.",
    openrouter: "Use OpenRouter gateway and model routing."
  };
  return descriptions[providerId] ?? "Configure this provider for orchestrator runs.";
}
