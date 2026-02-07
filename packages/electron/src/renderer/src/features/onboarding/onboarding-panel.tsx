import { useEffect, useMemo, useState } from "react";
import { Badge } from "@renderer/components/ai-elements/badge";
import { ScrollArea } from "@renderer/components/ai-elements/scroll-area";
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
  isRunningGuidedAuth: boolean;
  onboardingNotice: string | null;
  onSelectProvider: (providerId: string) => void;
  onEnvChange: (key: string, value: string) => void;
  onRunGuidedAuth: (providerId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

type OnboardingProvider = WorkbenchOnboarding["providers"][number];
type ProviderFamilyView = {
  id: string;
  label: string;
  hint?: string;
  providers: OnboardingProvider[];
};

export function OnboardingPanel(props: OnboardingPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [providerQuery, setProviderQuery] = useState("");
  const selectedProvider = resolveSelectedOnboardingProvider(props.onboarding, props.providerId);
  const providerFamilies = useMemo(
    () => resolveProviderFamilies(props.onboarding),
    [props.onboarding]
  );
  const filteredFamilies = useMemo(
    () => filterProviderFamilies(providerFamilies, providerQuery),
    [providerFamilies, providerQuery]
  );
  const envPartition = useMemo(
    () => splitEnvFields(selectedProvider?.envFields ?? []),
    [selectedProvider]
  );
  const guidedHiddenRequiredKeySet = useMemo(() => {
    if (!selectedProvider?.guidedAuth) {
      return new Set<string>();
    }
    return new Set(
      envPartition.required
        .filter((field) => shouldHideGuidedAuthField(field))
        .map((field) => field.key)
    );
  }, [envPartition.required, selectedProvider?.guidedAuth]);
  const visibleRequiredFields = useMemo(
    () =>
      envPartition.required.filter(
        (field) => !guidedHiddenRequiredKeySet.has(field.key)
      ),
    [envPartition.required, guidedHiddenRequiredKeySet]
  );

  useEffect(() => {
    setShowAdvanced(false);
  }, [selectedProvider?.id]);

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
  const visibleMissingRequiredKeys = useMemo(
    () =>
      missingRequiredKeys.filter(
        (key) => !guidedHiddenRequiredKeySet.has(key)
      ),
    [guidedHiddenRequiredKeySet, missingRequiredKeys]
  );
  const needsGuidedAuth = useMemo(
    () =>
      Boolean(selectedProvider?.guidedAuth) &&
      missingRequiredKeys.some((key) => guidedHiddenRequiredKeySet.has(key)),
    [guidedHiddenRequiredKeySet, missingRequiredKeys, selectedProvider?.guidedAuth]
  );
  const missingStatusMessage = useMemo(
    () => buildMissingStatusMessage(visibleMissingRequiredKeys, needsGuidedAuth),
    [needsGuidedAuth, visibleMissingRequiredKeys]
  );

  const canSubmit = Boolean(selectedProvider) && missingRequiredKeys.length === 0 && !props.isSubmitting;
  const totalProviderCount = providerFamilies.reduce((count, family) => count + family.providers.length, 0);

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(1200px_520px_at_14%_-18%,rgba(21,128,61,0.18),transparent_58%),radial-gradient(820px_440px_at_98%_0%,rgba(56,189,248,0.14),transparent_62%),linear-gradient(180deg,hsl(220_43%_8%),hsl(220_41%_6%))] text-[var(--foreground)]">
      <div className="mx-auto flex h-full w-full max-w-6xl px-3 py-3 md:px-6 md:py-5">
        <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--border)_85%,#0b1220)] bg-[color-mix(in_oklab,var(--surface)_93%,black)] shadow-[0_30px_120px_rgba(0,0,0,0.46)]">
          <header className="border-b border-[var(--border)] px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-heading text-2xl tracking-tight">OpenGoat Setup</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Select a provider, add credentials, and start your first orchestrator session.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,black)] text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]"
              >
                {totalProviderCount} providers
              </Badge>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
            <ProviderListPane
              providerId={props.providerId}
              families={filteredFamilies}
              query={providerQuery}
              disabled={props.isSubmitting}
              onQueryChange={setProviderQuery}
              onSelectProvider={props.onSelectProvider}
            />
            <SetupPane
              provider={selectedProvider}
              env={props.env}
              requiredFields={visibleRequiredFields}
              optionalFields={envPartition.optional}
              showAdvanced={showAdvanced}
              missingRequiredKeys={missingRequiredKeys}
              disabled={props.isSubmitting}
              isRunningGuidedAuth={props.isRunningGuidedAuth}
              onboardingNotice={props.onboardingNotice}
              onToggleAdvanced={() => setShowAdvanced((value) => !value)}
              onEnvChange={props.onEnvChange}
              onRunGuidedAuth={props.onRunGuidedAuth}
            />
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_95%,black)] px-5 py-3 md:px-6">
            <div className="min-h-5 text-xs text-[var(--muted-foreground)]">
              {props.error ? (
                <span className="text-red-300">{props.error}</span>
              ) : missingStatusMessage ? (
                <span className="text-amber-300">
                  {missingStatusMessage}
                </span>
              ) : selectedProvider ? (
                `Selected provider: ${selectedProvider.displayName} (${selectedProvider.id})`
              ) : (
                "Select a provider to continue"
              )}
            </div>
            <div className="flex items-center gap-2">
              {props.canClose ? (
                <Button variant="outline" onClick={props.onClose} disabled={props.isSubmitting}>
                  Close
                </Button>
              ) : null}
              <Button onClick={props.onSubmit} disabled={!canSubmit}>
                {props.isSubmitting ? "Saving..." : "Save and Start"}
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function ProviderListPane(props: {
  providerId: string;
  families: ProviderFamilyView[];
  query: string;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onSelectProvider: (providerId: string) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-[var(--border)] md:border-r md:border-b-0">
      <div className="space-y-3 border-b border-[var(--border)] p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Provider List
          </p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Compact view. Pick one provider.
          </p>
        </div>
        <Input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search providers"
          disabled={props.disabled}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {props.families.length === 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              No providers match this search.
            </div>
          ) : (
            props.families.map((family) => (
              <section key={family.id} className="space-y-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {family.label}
                  </p>
                  {family.hint ? (
                    <p className="text-xs text-[var(--muted-foreground)]">{family.hint}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {family.providers.map((provider) => (
                    <ProviderListItem
                      key={provider.id}
                      provider={provider}
                      selected={provider.id === props.providerId}
                      disabled={props.disabled}
                      onSelect={() => props.onSelectProvider(provider.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ProviderListItem(props: {
  provider: OnboardingProvider;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const requiredCount = props.provider.envFields.filter((field) => field.required).length;
  const missingCount = props.provider.missingRequiredEnv.length;

  return (
    <button
      type="button"
      onClick={props.onSelect}
      disabled={props.disabled}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
        props.selected
          ? "border-[var(--accent-strong)] bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]"
          : "border-transparent hover:border-[var(--border)] hover:bg-[color-mix(in_oklab,var(--surface)_92%,black)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">{props.provider.displayName}</p>
        <p className="truncate text-xs text-[var(--muted-foreground)]">{props.provider.id}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="border-[var(--border)] text-[10px] uppercase">
          {props.provider.kind}
        </Badge>
        {requiredCount > 0 ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              missingCount > 0
                ? "bg-amber-500/20 text-amber-200"
                : "bg-emerald-500/20 text-emerald-200"
            }`}
          >
            {missingCount > 0 ? `${missingCount} missing` : "ready"}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SetupPane(props: {
  provider: OnboardingProvider | null;
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
  isRunningGuidedAuth: boolean;
  onboardingNotice: string | null;
  onToggleAdvanced: () => void;
  onEnvChange: (key: string, value: string) => void;
  onRunGuidedAuth: (providerId: string) => void;
}) {
  if (!props.provider) {
    return (
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-[var(--border)] p-5">
          <p className="font-heading text-xl">Provider Setup</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Choose a provider from the list to continue.
          </p>
        </div>
      </div>
    );
  }

  const hasRequired = props.requiredFields.length > 0;
  const hasOptional = props.optionalFields.length > 0;
  const provider = props.provider;

  return (
    <section className="flex min-h-0 flex-col">
      <div className="border-b border-[var(--border)] p-5">
        <p className="font-heading text-xl">{provider.displayName}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Fill the required fields first. Optional fields stay hidden until needed.
        </p>
        {provider.guidedAuth ? (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm font-medium">{provider.guidedAuth.title}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{provider.guidedAuth.description}</p>
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={props.disabled || props.isRunningGuidedAuth}
                onClick={() => props.onRunGuidedAuth(provider.id)}
              >
                {props.isRunningGuidedAuth ? "Opening OAuth..." : "Sign in with OAuth"}
              </Button>
            </div>
            {props.onboardingNotice ? (
              <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,black)] p-2 text-xs text-[var(--muted-foreground)]">
                {props.onboardingNotice}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Required
            </p>
            {!hasRequired ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                {provider.guidedAuth
                  ? "Use OAuth sign-in above to populate required credentials."
                  : "No required credentials for this provider."}
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
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]/60 hover:bg-[color-mix(in_oklab,var(--surface-strong)_82%,black)]"
              >
                {props.showAdvanced ? "Hide Optional Fields" : "Show Optional Fields"}
              </button>
              {props.showAdvanced ? (
                <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_95%,black)] p-3">
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
      </ScrollArea>
    </section>
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
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{toHumanLabel(props.field.key)}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{props.field.description}</p>
        </div>
        {props.field.required ? (
          <Badge variant="outline" className="border-amber-400/50 bg-amber-400/10 text-[10px] text-amber-200">
            Required
          </Badge>
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
      {props.configured && !props.value ? (
        <p className={`text-xs ${props.missing ? "text-amber-300" : "text-[var(--muted-foreground)]"}`}>
          Currently configured.
        </p>
      ) : null}
    </div>
  );
}

function resolveSelectedOnboardingProvider(
  onboarding: WorkbenchOnboarding,
  selectedProviderId: string
): OnboardingProvider | null {
  const selected = selectedProviderId.trim();
  if (selected) {
    const found = onboarding.providers.find((provider) => provider.id === selected);
    if (found) {
      return found;
    }
  }
  return onboarding.providers[0] ?? null;
}

function resolveProviderFamilies(onboarding: WorkbenchOnboarding): ProviderFamilyView[] {
  const providerById = new Map(onboarding.providers.map((provider) => [provider.id, provider] as const));
  const usedIds = new Set<string>();

  const families = onboarding.families
    .map((family) => {
      const providers = family.providerIds
        .map((providerId) => providerById.get(providerId))
        .filter((provider): provider is OnboardingProvider => Boolean(provider));
      providers.forEach((provider) => usedIds.add(provider.id));
      return {
        id: family.id,
        label: family.label,
        hint: family.hint,
        providers
      };
    })
    .filter((family) => family.providers.length > 0);

  const leftovers = onboarding.providers
    .filter((provider) => !usedIds.has(provider.id))
    .map((provider) => ({
      id: `provider:${provider.id}`,
      label: provider.displayName,
      providers: [provider]
    }));

  return [...families, ...leftovers];
}

function filterProviderFamilies(families: ProviderFamilyView[], rawQuery: string): ProviderFamilyView[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return families;
  }

  return families
    .map((family) => {
      const familyText = `${family.label} ${family.hint ?? ""}`.toLowerCase();
      if (familyText.includes(query)) {
        return family;
      }

      const providers = family.providers.filter((provider) =>
        `${provider.displayName} ${provider.id}`.toLowerCase().includes(query)
      );
      return {
        ...family,
        providers
      };
    })
    .filter((family) => family.providers.length > 0);
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

function shouldHideGuidedAuthField(field: {
  key: string;
  secret?: boolean;
}): boolean {
  if (field.secret !== true) {
    return false;
  }
  const normalizedKey = field.key.trim().toUpperCase();
  return (
    normalizedKey.includes("OAUTH") ||
    normalizedKey.includes("TOKEN") ||
    normalizedKey.includes("REFRESH") ||
    normalizedKey.includes("EXPIRES")
  );
}

function buildMissingStatusMessage(
  missingFields: string[],
  needsGuidedAuth: boolean
): string | null {
  const parts: string[] = [];
  if (needsGuidedAuth) {
    parts.push("Complete OAuth sign-in to continue");
  }
  if (missingFields.length > 0) {
    parts.push(`Missing required fields: ${missingFields.join(", ")}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" • ");
}
