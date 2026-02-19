import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ReactElement } from "react";

export type InactiveAgentNotificationTarget = "all-managers" | "ceo-only";

interface SettingsPageProps {
  ceoBootstrapPending: boolean;
  defaultAgentId: string;
  taskCronIntervalMinutes: number;
  taskCronEnabledInput: boolean;
  bottomUpTaskDelegationEnabledInput: boolean;
  maxInactivityMinutesInput: string;
  maxInProgressMinutesInput: string;
  minMaxInactivityMinutes: number;
  maxMaxInactivityMinutes: number;
  minMaxInProgressMinutes: number;
  maxMaxInProgressMinutes: number;
  maxParallelFlowsInput: string;
  minMaxParallelFlows: number;
  maxMaxParallelFlows: number;
  inactiveAgentNotificationTargetInput: InactiveAgentNotificationTarget;
  uiAuthenticationEnabledInput: boolean;
  uiAuthenticationUsernameInput: string;
  uiAuthenticationHasPassword: boolean;
  uiAuthenticationPasswordEditorOpen: boolean;
  showAuthenticationPasswordEditor: boolean;
  showAuthenticationCurrentPasswordInput: boolean;
  uiAuthenticationCurrentPasswordInput: string;
  uiAuthenticationPasswordInput: string;
  uiAuthenticationPasswordConfirmationInput: string;
  isAuthenticationEnabled: boolean;
  isAuthenticated: boolean;
  isMutating: boolean;
  isLoading: boolean;
  onOpenCeoChat: (agentId: string) => void;
  onTaskCronEnabledChange: (checked: boolean) => void;
  onMaxParallelFlowsInputChange: (value: string) => void;
  onBottomUpTaskDelegationEnabledChange: (checked: boolean) => void;
  onMaxInactivityMinutesInputChange: (value: string) => void;
  onMaxInProgressMinutesInputChange: (value: string) => void;
  onInactiveAgentNotificationTargetInputChange: (
    nextValue: InactiveAgentNotificationTarget,
  ) => void;
  onUiAuthenticationEnabledChange: (checked: boolean) => void;
  onUiAuthenticationUsernameInputChange: (value: string) => void;
  onOpenPasswordEditor: () => void;
  onClosePasswordEditor: () => void;
  onUiAuthenticationCurrentPasswordInputChange: (value: string) => void;
  onUiAuthenticationPasswordInputChange: (value: string) => void;
  onUiAuthenticationPasswordConfirmationInputChange: (value: string) => void;
  onSignOut: () => void;
  onSaveSettings: () => void;
}

export function SettingsPage({
  ceoBootstrapPending,
  defaultAgentId,
  taskCronIntervalMinutes,
  taskCronEnabledInput,
  bottomUpTaskDelegationEnabledInput,
  maxInactivityMinutesInput,
  maxInProgressMinutesInput,
  minMaxInactivityMinutes,
  maxMaxInactivityMinutes,
  minMaxInProgressMinutes,
  maxMaxInProgressMinutes,
  maxParallelFlowsInput,
  minMaxParallelFlows,
  maxMaxParallelFlows,
  inactiveAgentNotificationTargetInput,
  uiAuthenticationEnabledInput,
  uiAuthenticationUsernameInput,
  uiAuthenticationHasPassword,
  uiAuthenticationPasswordEditorOpen,
  showAuthenticationPasswordEditor,
  showAuthenticationCurrentPasswordInput,
  uiAuthenticationCurrentPasswordInput,
  uiAuthenticationPasswordInput,
  uiAuthenticationPasswordConfirmationInput,
  isAuthenticationEnabled,
  isAuthenticated,
  isMutating,
  isLoading,
  onOpenCeoChat,
  onTaskCronEnabledChange,
  onMaxParallelFlowsInputChange,
  onBottomUpTaskDelegationEnabledChange,
  onMaxInactivityMinutesInputChange,
  onMaxInProgressMinutesInputChange,
  onInactiveAgentNotificationTargetInputChange,
  onUiAuthenticationEnabledChange,
  onUiAuthenticationUsernameInputChange,
  onOpenPasswordEditor,
  onClosePasswordEditor,
  onUiAuthenticationCurrentPasswordInputChange,
  onUiAuthenticationPasswordInputChange,
  onUiAuthenticationPasswordConfirmationInputChange,
  onSignOut,
  onSaveSettings,
}: SettingsPageProps): ReactElement {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Control automation runtime, task delegation strategy rules, and UI
          access controls.
        </p>
      </div>

      {ceoBootstrapPending ? (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-100">
              Send your first message to the CEO to finish setup and start
              background automation.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onOpenCeoChat(defaultAgentId);
              }}
            >
              Open CEO chat
            </Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Background Task Automation
            </h2>
            <p className="text-xs text-muted-foreground">
              Keep this on to run recurring background checks. These checks
              drive task follow-ups (todo, in-progress timeout reminders, and
              blocked reminders) and execute enabled delegation strategies.
            </p>
            <p className="text-xs text-muted-foreground">
              Check cadence: every {taskCronIntervalMinutes} minute.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={taskCronEnabledInput}
              disabled={isMutating || isLoading}
              onCheckedChange={onTaskCronEnabledChange}
              aria-label="Toggle task automation checks"
            />
            <span
              className={cn(
                "text-xs font-medium",
                taskCronEnabledInput ? "text-success" : "text-muted-foreground",
              )}
            >
              {taskCronEnabledInput ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        <Separator className="bg-border/60" />

        <div
          className={cn(
            "space-y-4 px-5 py-4",
            !taskCronEnabledInput && "opacity-60",
          )}
        >
          <div className="space-y-3">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="maxParallelFlows"
            >
              Max Parallel Flows
            </label>
            <div className="flex max-w-sm items-center gap-3">
              <Input
                id="maxParallelFlows"
                type="number"
                min={minMaxParallelFlows}
                max={maxMaxParallelFlows}
                step={1}
                value={maxParallelFlowsInput}
                disabled={!taskCronEnabledInput || isMutating || isLoading}
                onChange={(event) => {
                  onMaxParallelFlowsInputChange(event.target.value);
                }}
              />
              <span className="text-sm text-muted-foreground">
                concurrent runs
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Controls how many task automation flows can run at the same time.
              Higher values increase throughput.
            </p>
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-3">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="maxInProgressMinutes"
            >
              In Progress Timeout
            </label>
            <div className="flex max-w-sm items-center gap-3">
              <Input
                id="maxInProgressMinutes"
                type="number"
                min={minMaxInProgressMinutes}
                max={maxMaxInProgressMinutes}
                step={1}
                value={maxInProgressMinutesInput}
                disabled={!taskCronEnabledInput || isMutating || isLoading}
                onChange={(event) => {
                  onMaxInProgressMinutesInputChange(event.target.value);
                }}
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              If a task stays in <strong>In progress</strong> longer than this
              timeout, the assignee gets a reminder and the countdown restarts.
            </p>
          </div>

          {ceoBootstrapPending ? (
            <p className="text-xs text-muted-foreground">
              Background checks stay paused until the first CEO message removes
              bootstrap mode.
            </p>
          ) : !taskCronEnabledInput ? (
            <p className="text-xs text-muted-foreground">
              Background checks are paused. Enable task automation above to
              resume task follow-up and delegation checks.
            </p>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Task Delegation Strategy
            </h2>
            <p className="text-xs text-muted-foreground">
              This section defines how OpenGoat decides what tasks to create
              for agents to work on.
            </p>
            <p className="text-xs text-muted-foreground">
              Multiple strategies can be enabled at the same time.
            </p>
          </div>
        </div>

        <Separator className="bg-border/60" />

        <div
          className={cn(
            "space-y-4 px-5 py-4",
            !taskCronEnabledInput && "opacity-60",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Bottom-Up Task Delegation
              </h3>
              <p className="text-xs text-muted-foreground">
                Detects inactive agents and creates manager-facing follow-up
                tasks so delegation starts from team-level activity signals.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={bottomUpTaskDelegationEnabledInput}
                disabled={!taskCronEnabledInput || isMutating || isLoading}
                onCheckedChange={onBottomUpTaskDelegationEnabledChange}
                aria-label="Toggle bottom-up task delegation"
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  bottomUpTaskDelegationEnabledInput && taskCronEnabledInput
                    ? "text-success"
                    : "text-muted-foreground",
                )}
              >
                {bottomUpTaskDelegationEnabledInput && taskCronEnabledInput
                  ? "Enabled"
                  : "Disabled"}
              </span>
            </div>
          </div>

          {bottomUpTaskDelegationEnabledInput ? (
            <>
              <Separator className="bg-border/50" />

              <div className="space-y-3">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="maxInactivityMinutes"
                >
                  Max Inactivity Time
                </label>
                <div className="flex max-w-sm items-center gap-3">
                  <Input
                    id="maxInactivityMinutes"
                    type="number"
                    min={minMaxInactivityMinutes}
                    max={maxMaxInactivityMinutes}
                    step={1}
                    value={maxInactivityMinutesInput}
                    disabled={!taskCronEnabledInput || isMutating || isLoading}
                    onChange={(event) => {
                      onMaxInactivityMinutesInputChange(event.target.value);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bottom-Up delegation checks inactivity with this threshold
                  before generating follow-up tasks.
                </p>
              </div>

              <Separator className="bg-border/50" />

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="inactiveAgentNotificationTarget"
                >
                  Notify CEO only
                </label>
                <Select
                  value={inactiveAgentNotificationTargetInput}
                  onValueChange={(nextValue) => {
                    onInactiveAgentNotificationTargetInputChange(
                      nextValue as InactiveAgentNotificationTarget,
                    );
                  }}
                  disabled={!taskCronEnabledInput || isMutating || isLoading}
                >
                  <SelectTrigger
                    id="inactiveAgentNotificationTarget"
                    className="max-w-sm"
                  >
                    <SelectValue placeholder="Select who gets inactivity notifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-managers">
                      Notify all managers
                    </SelectItem>
                    <SelectItem value="ceo-only">Notify only CEO</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {inactiveAgentNotificationTargetInput === "ceo-only"
                    ? "Only the CEO receives inactivity alerts, and only for agents that report directly to the CEO."
                    : "Every manager receives inactivity alerts for their own direct reports."}
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Bottom-Up task delegation is paused. Task automation can still run
              other enabled strategies and follow-up checks.
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              UI Authentication
            </h2>
            <p className="text-xs text-muted-foreground">
              Require a username and password before API access to this UI.
            </p>
            <p className="text-xs text-muted-foreground">
              Use HTTPS when exposing this port publicly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={uiAuthenticationEnabledInput}
              disabled={isMutating || isLoading}
              onCheckedChange={onUiAuthenticationEnabledChange}
              aria-label="Toggle UI authentication"
            />
            <span
              className={cn(
                "text-xs font-medium",
                uiAuthenticationEnabledInput
                  ? "text-success"
                  : "text-muted-foreground",
              )}
            >
              {uiAuthenticationEnabledInput ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {uiAuthenticationEnabledInput ? (
          <>
            <Separator className="bg-border/60" />

            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="uiAuthenticationUsername"
                >
                  Username
                </label>
                <Input
                  id="uiAuthenticationUsername"
                  autoComplete="username"
                  value={uiAuthenticationUsernameInput}
                  disabled={isMutating || isLoading}
                  onChange={(event) => {
                    onUiAuthenticationUsernameInputChange(event.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  3-64 characters: lowercase letters, numbers, dots, dashes, or
                  underscores.
                </p>
              </div>

              {uiAuthenticationHasPassword &&
              !uiAuthenticationPasswordEditorOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/30 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Password is already configured. Use Change Password to
                    rotate credentials.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isMutating || isLoading}
                    onClick={onOpenPasswordEditor}
                  >
                    Change Password
                  </Button>
                </div>
              ) : null}

              {showAuthenticationPasswordEditor ? (
                <div className="space-y-4">
                  {uiAuthenticationHasPassword &&
                  uiAuthenticationPasswordEditorOpen ? (
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isMutating || isLoading}
                        onClick={onClosePasswordEditor}
                      >
                        Cancel Password Change
                      </Button>
                    </div>
                  ) : null}

                  {showAuthenticationCurrentPasswordInput ? (
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium text-foreground"
                        htmlFor="uiAuthenticationCurrentPassword"
                      >
                        Current Password
                      </label>
                      <Input
                        id="uiAuthenticationCurrentPassword"
                        type="password"
                        autoComplete="current-password"
                        value={uiAuthenticationCurrentPasswordInput}
                        disabled={isMutating || isLoading}
                        onChange={(event) => {
                          onUiAuthenticationCurrentPasswordInputChange(
                            event.target.value,
                          );
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Required when changing authentication settings.
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="uiAuthenticationPassword"
                    >
                      {uiAuthenticationHasPassword ? "New Password" : "Password"}
                    </label>
                    <Input
                      id="uiAuthenticationPassword"
                      type="password"
                      autoComplete="new-password"
                      value={uiAuthenticationPasswordInput}
                      disabled={isMutating || isLoading}
                      onChange={(event) => {
                        onUiAuthenticationPasswordInputChange(event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="uiAuthenticationPasswordConfirm"
                    >
                      Confirm Password
                    </label>
                    <Input
                      id="uiAuthenticationPasswordConfirm"
                      type="password"
                      autoComplete="new-password"
                      value={uiAuthenticationPasswordConfirmationInput}
                      disabled={isMutating || isLoading}
                      onChange={(event) => {
                        onUiAuthenticationPasswordConfirmationInputChange(
                          event.target.value,
                        );
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use at least 12 characters with uppercase, lowercase,
                      number, and symbol.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Status:{" "}
          <span className="font-medium text-foreground">
            {ceoBootstrapPending
              ? "Waiting for first CEO message to start checks"
              : !taskCronEnabledInput
                ? "Background checks paused"
                : !bottomUpTaskDelegationEnabledInput
                  ? "Background checks active (Bottom-Up delegation paused)"
                  : inactiveAgentNotificationTargetInput === "ceo-only"
                    ? "Background checks active (Bottom-Up strategy: CEO-only inactivity routing)"
                    : "Background checks active for all managers"}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {isAuthenticationEnabled && isAuthenticated ? (
            <Button
              variant="secondary"
              onClick={onSignOut}
              disabled={isMutating || isLoading}
            >
              Sign Out
            </Button>
          ) : null}
          <Button
            onClick={onSaveSettings}
            disabled={isMutating || isLoading}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </section>
  );
}
