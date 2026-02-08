import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@renderer/components/ai-elements/dialog";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import type { WorkbenchGatewayMode } from "@shared/workbench";

interface RuntimeSettingsModalProps {
  open: boolean;
  gateway: {
    mode: WorkbenchGatewayMode;
    remoteUrl: string;
    remoteToken: string;
    timeoutMs: number;
  };
  error: string | null;
  disabled: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onGatewayChange: (
    patch: Partial<{
      mode: WorkbenchGatewayMode;
      remoteUrl: string;
      remoteToken: string;
      timeoutMs: number;
    }>
  ) => void;
  onSave: () => void;
}

export function RuntimeSettingsModal(props: RuntimeSettingsModalProps) {
  const isRemote = props.gateway.mode === "remote";
  const canSave = !props.disabled && (!isRemote || Boolean(props.gateway.remoteUrl.trim()));

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl border border-[var(--border)]/80 bg-[color-mix(in_oklab,var(--surface)_92%,black)]">
        <DialogHeader>
          <DialogTitle>Runtime Settings</DialogTitle>
          <DialogDescription>
            Configure how OpenGoat Desktop connects to the orchestrator runtime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)]/80 bg-[color-mix(in_oklab,var(--surface)_96%,black)] px-3 py-2 text-sm">
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
            <span className="ml-auto rounded-full border border-[var(--border)]/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
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

          {props.error ? (
            <p className="text-xs text-red-300">{props.error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.disabled}>
            Close
          </Button>
          <Button onClick={props.onSave} disabled={!canSave}>
            {props.isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clampGatewayTimeout(value: number): number {
  if (!Number.isFinite(value)) {
    return 10_000;
  }
  return Math.max(1000, Math.min(120_000, Math.floor(value)));
}

