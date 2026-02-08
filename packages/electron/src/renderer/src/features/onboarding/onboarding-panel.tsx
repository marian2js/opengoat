import { Badge } from "@renderer/components/ai-elements/badge";
import { ScrollArea } from "@renderer/components/ai-elements/scroll-area";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import type { WorkbenchGatewayMode, WorkbenchOnboarding } from "@shared/workbench";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

interface OnboardingPanelProps {
  onboarding: WorkbenchOnboarding;
  providerId: string;
  env: Record<string, string>;
  gateway: {
    mode: WorkbenchGatewayMode;
    remoteUrl: string;
    remoteToken: string;
    timeoutMs: number;
  };
  error: string | null;
  canClose: boolean;
  isSubmitting: boolean;
  isSavingGateway: boolean;
  isRunningGuidedAuth: boolean;
  onboardingNotice: string | null;
  onSelectProvider: (providerId: string) => void;
  onEnvChange: (key: string, value: string) => void;
  onGatewayChange: (
    patch: Partial<{
      mode: WorkbenchGatewayMode;
      remoteUrl: string;
      remoteToken: string;
      timeoutMs: number;
    }>
  ) => void;
  onSaveGateway: () => void;
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
const ONBOARDING_STEPS = [
  "Select provider",
  "Add credentials",
  "Save and start",
] as const;

export function OnboardingPanel(props: OnboardingPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);
  const [providerQuery, setProviderQuery] = useState("");
  const isMac = useMemo(() => detectMacPlatform(), []);
  const selectedProvider = resolveSelectedOnboardingProvider(
    props.onboarding,
    props.providerId,
  );
  const providerFamilies = useMemo(
    () => resolveProviderFamilies(props.onboarding),
    [props.onboarding],
  );
  const filteredFamilies = useMemo(
    () => filterProviderFamilies(providerFamilies, providerQuery),
    [providerFamilies, providerQuery],
  );
  const envPartition = useMemo(
    () => splitEnvFields(selectedProvider?.envFields ?? []),
    [selectedProvider],
  );
  const guidedHiddenRequiredKeySet = useMemo(() => {
    if (!selectedProvider?.guidedAuth) {
      return new Set<string>();
    }
    return new Set(
      envPartition.required
        .filter((field) => shouldHideGuidedAuthField(field))
        .map((field) => field.key),
    );
  }, [envPartition.required, selectedProvider?.guidedAuth]);
  const visibleRequiredFields = useMemo(
    () =>
      envPartition.required.filter(
        (field) => !guidedHiddenRequiredKeySet.has(field.key),
      ),
    [envPartition.required, guidedHiddenRequiredKeySet],
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
        const configured = selectedProvider.configuredEnvKeys.includes(
          field.key,
        );
        const value = props.env[field.key] ?? "";
        return !isFieldSatisfied({
          required: field.required === true,
          configured,
          value,
        });
      })
      .map((field) => field.key);
  }, [envPartition.required, props.env, selectedProvider]);
  const visibleMissingRequiredKeys = useMemo(
    () =>
      missingRequiredKeys.filter((key) => !guidedHiddenRequiredKeySet.has(key)),
    [guidedHiddenRequiredKeySet, missingRequiredKeys],
  );
  const needsGuidedAuth = useMemo(
    () =>
      Boolean(selectedProvider?.guidedAuth) &&
      missingRequiredKeys.some((key) => guidedHiddenRequiredKeySet.has(key)),
    [
      guidedHiddenRequiredKeySet,
      missingRequiredKeys,
      selectedProvider?.guidedAuth,
    ],
  );
  const missingStatusMessage = useMemo(
    () =>
      buildMissingStatusMessage(visibleMissingRequiredKeys, needsGuidedAuth),
    [needsGuidedAuth, visibleMissingRequiredKeys],
  );

  const canSubmit =
    Boolean(selectedProvider) &&
    missingRequiredKeys.length === 0 &&
    !props.isSubmitting;

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(1300px_620px_at_-10%_-16%,hsl(162_78%_49%_/_0.18),transparent_58%),radial-gradient(1100px_520px_at_120%_-10%,hsl(194_86%_54%_/_0.14),transparent_60%),linear-gradient(180deg,hsl(220_42%_8%),hsl(221_38%_6%))] text-[var(--foreground)]">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        className="flex h-full w-full min-h-0 flex-col"
      >
        <header className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_86%,black)]">
          <div className="titlebar-drag-region flex h-11 items-center gap-3 px-4 md:px-6">
            {isMac ? <div className="h-full w-[76px] shrink-0" /> : null}
            <div className="flex-1" />
            <div className="titlebar-no-drag flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full border border-[var(--border)] bg-[var(--surface)]/85 px-3 text-xs text-[var(--muted-foreground)] transition hover:border-[var(--accent)]/70 hover:text-[var(--foreground)]"
                onClick={() => setShowConnectionPanel((value) => !value)}
                disabled={props.isSubmitting}
              >
                Runtime: {props.gateway.mode === "remote" ? "Remote" : "Local"}
                <ChevronDown className="size-3.5 opacity-80" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div
            className={
              isMac
                ? "space-y-3 pb-5 pl-[92px] pr-4 md:pb-6 md:pr-6"
                : "space-y-3 px-4 pb-5 md:px-6 md:pb-6"
            }
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/85">
                OpenGoat Setup
              </p>
              <h1 className="font-heading text-[clamp(1.65rem,2.8vw,2.35rem)] font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
                Setup the Orchestrator Agent
              </h1>
              <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
                Set a provider for the Orchestrator. This agent is in charge of the coordination between all your agents.
              </p>
            </div>
            <ol className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
              {ONBOARDING_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1"
                >
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_55%,var(--surface))] text-[10px] font-semibold text-[var(--foreground)]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </header>

        {showConnectionPanel ? (
          <ConnectionSettingsPane
            gateway={props.gateway}
            disabled={props.isSubmitting || props.isSavingGateway}
            isSaving={props.isSavingGateway}
            onGatewayChange={props.onGatewayChange}
            onSave={props.onSaveGateway}
            onClose={() => setShowConnectionPanel(false)}
          />
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 border-b border-[var(--border)] lg:grid-cols-[340px_minmax(0,1fr)]">
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

        <footer className="flex flex-wrap items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--surface)_92%,black)] px-5 py-3 md:px-8">
          <div className="min-h-5 text-xs text-[var(--muted-foreground)]">
            {props.error ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-300"
              >
                {props.error}
              </motion.span>
            ) : missingStatusMessage ? (
              <span className="text-amber-300">{missingStatusMessage}</span>
            ) : selectedProvider ? (
              `Selected provider: ${selectedProvider.displayName} (${selectedProvider.id})`
            ) : (
              "Select a provider to continue"
            )}
          </div>
          <div className="flex items-center gap-2">
            {props.canClose ? (
              <Button
                variant="outline"
                onClick={props.onClose}
                disabled={props.isSubmitting}
              >
                Close
              </Button>
            ) : null}
            <Button
              variant="glow"
              onClick={props.onSubmit}
              disabled={!canSubmit}
            >
              {props.isSubmitting ? "Saving..." : "Save and Start"}
            </Button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform = navigator.platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(userAgent);
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
    <aside className="flex min-h-0 flex-col border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,black)] lg:border-r lg:border-b-0">
      <div className="space-y-3 border-b border-[var(--border)] px-4 py-4 md:px-5">
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
        <div className="space-y-4 p-3 md:p-4">
          {props.families.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
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
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {family.hint}
                    </p>
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
  const requiredCount = props.provider.envFields.filter(
    (field) => field.required,
  ).length;
  const missingCount = props.provider.missingRequiredEnv.length;

  return (
    <button
      type="button"
      onClick={props.onSelect}
      disabled={props.disabled}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${props.selected
        ? "border-[var(--accent-strong)] bg-[color-mix(in_oklab,var(--accent)_24%,transparent)] shadow-[inset_0_0_0_1px_hsl(162_72%_39%_/_0.22)]"
        : "border-transparent hover:border-[var(--border)] hover:bg-[color-mix(in_oklab,var(--surface)_88%,black)]"
        }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">
          {props.provider.displayName}
        </p>
        <p className="truncate text-xs text-[var(--muted-foreground)]">
          {props.provider.id}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className="border-[var(--border)] text-[10px] uppercase"
        >
          {props.provider.kind}
        </Badge>
        {requiredCount > 0 ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${missingCount > 0
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
      <div className="flex min-h-0 flex-col bg-[color-mix(in_oklab,var(--surface)_88%,black)]">
        <div className="border-b border-[var(--border)] p-5 md:px-7">
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
    <section className="flex min-h-0 flex-col bg-[color-mix(in_oklab,var(--surface)_88%,black)]">
      <div className="border-b border-[var(--border)] p-5 md:px-7">
        <p className="font-heading text-xl">{provider.displayName}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Fill the required fields first. Optional fields stay hidden until
          needed.
        </p>
        {provider.guidedAuth ? (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm font-medium">{provider.guidedAuth.title}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {provider.guidedAuth.description}
            </p>
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={props.disabled || props.isRunningGuidedAuth}
                onClick={() => props.onRunGuidedAuth(provider.id)}
              >
                {props.isRunningGuidedAuth
                  ? "Opening OAuth..."
                  : "Sign in with OAuth"}
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
        <div className="space-y-5 p-5 md:px-7">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Required
            </p>
            {!hasRequired ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                {provider.guidedAuth
                  ? "Use OAuth sign-in above to populate required credentials."
                  : "No required credentials for this provider."}
              </div>
            ) : (
              props.requiredFields.map((field) => {
                const configured = provider.configuredEnvKeys.includes(
                  field.key,
                );
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

          <section className="space-y-3">
            <button
              type="button"
              onClick={props.onToggleAdvanced}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]/60 hover:bg-[color-mix(in_oklab,var(--surface-strong)_82%,black)]"
            >
              {props.showAdvanced
                ? "Hide Advanced Options"
                : "Show Advanced Options"}
            </button>
            {props.showAdvanced ? (
              <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_95%,black)] p-3">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Optional Provider Fields
                  </p>
                  {hasOptional ? (
                    props.optionalFields.map((field) => {
                      const configured = provider.configuredEnvKeys.includes(
                        field.key,
                      );
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
                    })
                  ) : (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                      No optional provider fields for this provider.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </ScrollArea>
    </section>
  );
}

function ConnectionSettingsPane(props: {
  gateway: {
    mode: WorkbenchGatewayMode;
    remoteUrl: string;
    remoteToken: string;
    timeoutMs: number;
  };
  disabled: boolean;
  isSaving: boolean;
  onGatewayChange: (
    patch: Partial<{
      mode: WorkbenchGatewayMode;
      remoteUrl: string;
      remoteToken: string;
      timeoutMs: number;
    }>
  ) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const isRemote = props.gateway.mode === "remote";
  const canSave = !props.disabled && (!isRemote || Boolean(props.gateway.remoteUrl.trim()));

  return (
    <section className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,black)] px-5 py-3 md:px-8">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              OpenGoat Runtime Connection
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Optional. Keep local unless OpenGoat runs on a different machine.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[var(--muted-foreground)]"
            onClick={props.onClose}
          >
            Close
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_95%,black)] px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={isRemote}
              disabled={props.disabled}
              onChange={(event) =>
                props.onGatewayChange({
                  mode: event.currentTarget.checked ? "remote" : "local"
                })
              }
            />
            <span>Connect to remote OpenGoat</span>
            <span className="ml-auto rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
              {isRemote ? "Remote" : "Local"}
            </span>
          </label>

          {isRemote ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--foreground)]">
                  Remote gateway URL
                </p>
                <Input
                  value={props.gateway.remoteUrl}
                  onChange={(event) =>
                    props.onGatewayChange({
                      remoteUrl: event.target.value
                    })
                  }
                  placeholder="ws://remote-host:18789/gateway"
                  disabled={props.disabled}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    Auth token (optional)
                  </p>
                  <Input
                    type="password"
                    value={props.gateway.remoteToken}
                    onChange={(event) =>
                      props.onGatewayChange({
                        remoteToken: event.target.value
                      })
                    }
                    placeholder="Keep empty to leave token unchanged"
                    disabled={props.disabled}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    Timeout (ms)
                  </p>
                  <Input
                    type="number"
                    min={1000}
                    max={120000}
                    step={500}
                    value={String(props.gateway.timeoutMs)}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (!Number.isFinite(parsed)) {
                        return;
                      }
                      props.onGatewayChange({
                        timeoutMs: clampGatewayTimeout(parsed)
                      });
                    }}
                    disabled={props.disabled}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={props.onSave}
              disabled={!canSave}
            >
              {props.isSaving ? "Saving Connection..." : "Save Connection"}
            </Button>
          </div>
        </div>
      </div>
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
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">
            {toHumanLabel(props.field.key)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {props.field.description}
          </p>
        </div>
        {props.field.required ? (
          <Badge
            variant="outline"
            className="border-amber-400/50 bg-amber-400/10 text-[10px] text-amber-200"
          >
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
        <p
          className={`text-xs ${props.missing ? "text-amber-300" : "text-[var(--muted-foreground)]"
            }`}
        >
          Currently configured.
        </p>
      ) : null}
    </div>
  );
}

function resolveSelectedOnboardingProvider(
  onboarding: WorkbenchOnboarding,
  selectedProviderId: string,
): OnboardingProvider | null {
  const selected = selectedProviderId.trim();
  if (selected) {
    const found = onboarding.providers.find(
      (provider) => provider.id === selected,
    );
    if (found) {
      return found;
    }
  }
  return onboarding.providers[0] ?? null;
}

function resolveProviderFamilies(
  onboarding: WorkbenchOnboarding,
): ProviderFamilyView[] {
  const providerById = new Map(
    onboarding.providers.map((provider) => [provider.id, provider] as const),
  );
  const usedIds = new Set<string>();

  const families = onboarding.families
    .map((family) => {
      const providers = family.providerIds
        .map((providerId) => providerById.get(providerId))
        .filter((provider): provider is OnboardingProvider =>
          Boolean(provider),
        );
      providers.forEach((provider) => usedIds.add(provider.id));
      return {
        id: family.id,
        label: family.label,
        hint: family.hint,
        providers,
      };
    })
    .filter((family) => family.providers.length > 0);

  const leftovers = onboarding.providers
    .filter((provider) => !usedIds.has(provider.id))
    .map((provider) => ({
      id: `provider:${provider.id}`,
      label: provider.displayName,
      providers: [provider],
    }));

  return [...families, ...leftovers];
}

function filterProviderFamilies(
  families: ProviderFamilyView[],
  rawQuery: string,
): ProviderFamilyView[] {
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
        `${provider.displayName} ${provider.id}`.toLowerCase().includes(query),
      );
      return {
        ...family,
        providers,
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
  }>,
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
  needsGuidedAuth: boolean,
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

function clampGatewayTimeout(value: number): number {
  if (!Number.isFinite(value)) {
    return 10_000;
  }
  return Math.max(1000, Math.min(120_000, Math.floor(value)));
}
