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

export function OnboardingPanel(props: OnboardingPanelProps) {
  const selectedProvider = resolveSelectedOnboardingProvider(
    props.onboarding,
    props.providerId
  );

  return (
    <div className="flex h-screen items-center justify-center bg-[radial-gradient(1200px_500px_at_10%_-20%,_rgba(22,163,74,0.16),transparent_55%),radial-gradient(900px_450px_at_100%_0%,_rgba(245,158,11,0.15),transparent_55%),var(--background)] px-6 text-[var(--foreground)]">
      <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="font-heading text-2xl">Finish Provider Setup</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Configure the orchestrator provider directly in the desktop app.
        </p>

        <div className="mt-5 space-y-3">
          <label
            className="block text-sm text-[var(--muted-foreground)]"
            htmlFor="provider-select"
          >
            Provider
          </label>
          <select
            id="provider-select"
            value={props.providerId}
            onChange={(event) => {
              props.onSelectProvider(event.target.value);
            }}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm"
            disabled={props.isSubmitting}
          >
            {props.onboarding.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName} ({provider.id})
              </option>
            ))}
          </select>
        </div>

        {selectedProvider ? (
          <div className="mt-5 space-y-3">
            {selectedProvider.envFields.length === 0 ? (
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                This provider has no environment fields. Click Continue to save selection.
              </p>
            ) : (
              selectedProvider.envFields.map((field) => {
                const value = props.env[field.key] ?? "";
                const isConfigured = selectedProvider.configuredEnvKeys.includes(field.key);
                return (
                  <div key={field.key} className="space-y-1">
                    <p className="text-sm font-medium">
                      {field.key}
                      {field.required ? " *" : ""}
                    </p>
                    <Input
                      type={field.secret ? "password" : "text"}
                      value={value}
                      onChange={(event) => {
                        props.onEnvChange(field.key, event.target.value);
                      }}
                      placeholder={field.description}
                      disabled={props.isSubmitting}
                    />
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {field.description}
                      {isConfigured && !value ? " (currently configured)" : ""}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {props.error ? (
          <div className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {props.error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
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
            onClick={props.onSubmit}
            disabled={props.isSubmitting || !props.providerId}
          >
            {props.isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
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
