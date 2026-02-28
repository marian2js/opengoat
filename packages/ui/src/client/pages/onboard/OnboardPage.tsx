import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, GitBranch, Plus, RefreshCcw } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import opengoatLogo from "../../../../../../assets/opengoat.png";

type BuildMode = "new" | "existing" | null;
type RunState = "idle" | "creating-session" | "streaming" | "ready" | "error";

interface WorkspaceSessionResponse {
  agentId: string;
  session: {
    sessionKey: string;
    sessionId: string;
  };
  message?: string;
}

interface SessionSendMessageResponse {
  agentId: string;
  sessionRef: string;
  output: string;
  result: {
    code: number;
    stdout: string;
    stderr: string;
  };
  message?: string;
}

type SessionMessageProgressPhase =
  | "queued"
  | "run_started"
  | "provider_invocation_started"
  | "provider_invocation_completed"
  | "run_completed"
  | "stdout"
  | "stderr"
  | "heartbeat";

interface SessionMessageProgressStreamEvent {
  type: "progress";
  phase: SessionMessageProgressPhase;
  timestamp: string;
  message: string;
}

interface SessionMessageResultStreamEvent {
  type: "result";
  agentId: string;
  sessionRef: string;
  output: string;
  result: {
    code: number;
    stdout: string;
    stderr: string;
  };
  message?: string;
}

interface SessionMessageErrorStreamEvent {
  type: "error";
  timestamp: string;
  error: string;
}

type SessionMessageStreamEvent =
  | SessionMessageProgressStreamEvent
  | SessionMessageResultStreamEvent
  | SessionMessageErrorStreamEvent;

interface OnboardingSessionInfo {
  agentId: string;
  sessionRef: string;
  sessionId: string;
}

interface OnboardingConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_AGENT_ID = "goat";
const ONBOARDING_WORKSPACE_NAME = "Onboarding Roadmap";
const MAX_PROGRESS_ITEMS = 6;

export function OnboardPage(): ReactElement {
  const [projectSummary, setProjectSummary] = useState("");
  const [buildMode, setBuildMode] = useState<BuildMode>(null);
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [sevenDayGoal, setSevenDayGoal] = useState("");
  const [appName, setAppName] = useState("");
  const [mvpFeature, setMvpFeature] = useState("");

  const [runState, setRunState] = useState<RunState>("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<OnboardingSessionInfo | null>(
    null,
  );
  const [conversation, setConversation] = useState<
    OnboardingConversationMessage[]
  >([]);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [roadmapApproved, setRoadmapApproved] = useState(false);
  const [needsChangesOpen, setNeedsChangesOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");

  const stepOneComplete = projectSummary.trim().length > 0;
  const stepTwoComplete = buildMode !== null;
  const repoLooksValid = useMemo(
    () =>
      githubRepoUrl.trim().length === 0 ||
      /^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/i.test(
        githubRepoUrl.trim(),
      ),
    [githubRepoUrl],
  );
  const existingFlowComplete =
    githubRepoUrl.trim().length > 0 &&
    repoLooksValid &&
    sevenDayGoal.trim().length > 0;
  const newFlowComplete =
    appName.trim().length > 0 && mvpFeature.trim().length > 0;
  const canContinue =
    stepOneComplete &&
    stepTwoComplete &&
    (buildMode === "existing"
      ? existingFlowComplete
      : buildMode === "new"
        ? newFlowComplete
        : false);

  const isBusy = runState === "creating-session" || runState === "streaming";

  const onboardingData = useMemo(
    () => ({
      projectSummary: trimAndNormalize(projectSummary),
      buildMode,
      githubRepoUrl: trimAndNormalize(githubRepoUrl),
      sevenDayGoal: trimAndNormalize(sevenDayGoal),
      appName: trimAndNormalize(appName),
      mvpFeature: trimAndNormalize(mvpFeature),
    }),
    [appName, buildMode, githubRepoUrl, mvpFeature, projectSummary, sevenDayGoal],
  );

  const latestAssistantMessage = useMemo(() => {
    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      const candidate = conversation[index];
      if (candidate?.role === "assistant") {
        return candidate;
      }
    }
    return null;
  }, [conversation]);

  async function ensureOnboardingSession(): Promise<OnboardingSessionInfo> {
    if (sessionInfo) {
      return sessionInfo;
    }

    setRunState("creating-session");
    const response = await fetchJson<WorkspaceSessionResponse>(
      "/api/workspaces/session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: DEFAULT_AGENT_ID,
          workspaceName: ONBOARDING_WORKSPACE_NAME,
        }),
      },
    );

    const created: OnboardingSessionInfo = {
      agentId: response.agentId || DEFAULT_AGENT_ID,
      sessionRef: response.session.sessionKey,
      sessionId: response.session.sessionId,
    };
    setSessionInfo(created);
    return created;
  }

  async function runRoadmapRequest(input: {
    userVisibleMessage: string;
    agentMessage: string;
  }): Promise<void> {
    setRunError(null);
    setRoadmapApproved(false);
    setNeedsChangesOpen(false);
    setProgressMessages([]);

    const userMessage: OnboardingConversationMessage = {
      id: createMessageId("user"),
      role: "user",
      content: input.userVisibleMessage,
    };
    setConversation((current) => [...current, userMessage]);

    try {
      const currentSession = await ensureOnboardingSession();
      setRunState("streaming");

      const response = await sendSessionMessageStream(
        {
          agentId: currentSession.agentId,
          sessionRef: currentSession.sessionRef,
          message: input.agentMessage,
        },
        {
          onEvent: (event) => {
            if (event.type !== "progress") {
              return;
            }
            const nextMessage = event.message.trim();
            if (!nextMessage) {
              return;
            }
            setProgressMessages((current) => {
              if (current[current.length - 1] === nextMessage) {
                return current;
              }
              const next = [...current, nextMessage];
              return next.length > MAX_PROGRESS_ITEMS
                ? next.slice(next.length - MAX_PROGRESS_ITEMS)
                : next;
            });
          },
        },
      );

      const assistantOutput =
        response.output.trim() || "Goat returned no roadmap output.";
      setConversation((current) => [
        ...current,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: assistantOutput,
        },
      ]);

      if (response.result.code !== 0) {
        setRunError(
          `Goat completed with code ${response.result.code}. You can request changes and continue in this session.`,
        );
        setRunState("error");
        return;
      }

      setRunState("ready");
    } catch (error) {
      setRunError(
        error instanceof Error
          ? error.message
          : "Unable to generate roadmap. Please try again.",
      );
      setRunState("error");
    }
  }

  async function handleGenerateRoadmap(): Promise<void> {
    if (!canContinue || isBusy) {
      return;
    }

    await runRoadmapRequest({
      userVisibleMessage: buildOnboardingSummaryForUser(onboardingData),
      agentMessage: buildInitialRoadmapPrompt(onboardingData),
    });
  }

  async function handleSubmitFeedback(): Promise<void> {
    const feedback = feedbackDraft.trim();
    if (!feedback || isBusy || !latestAssistantMessage) {
      return;
    }

    setFeedbackDraft("");
    await runRoadmapRequest({
      userVisibleMessage: `Requested roadmap changes:\n${feedback}`,
      agentMessage: buildRoadmapRevisionPrompt(feedback),
    });
  }

  return (
    <main
      className="opengoat-onboard-shell relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_-5%,rgba(91,141,255,0.2),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(38,213,184,0.14),transparent_34%),linear-gradient(160deg,#06070d_0%,#0a1121_46%,#06080f_100%)] text-foreground"
      style={{
        fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
      }}
    >
      <div className="-left-20 absolute top-20 size-72 rounded-full bg-sky-400/12 blur-3xl opengoat-onboard-orb" />
      <div className="absolute bottom-16 right-0 size-72 rounded-full bg-cyan-300/10 blur-3xl opengoat-onboard-orb [animation-delay:1.8s]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black_30%,transparent_85%)] opacity-35" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <section className="opengoat-onboard-hero-card rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_42%,rgba(255,255,255,0.01)_100%)] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.58)] backdrop-blur-xl sm:p-8">
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Welcome to OpenGoat.
          </h1>
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-3 py-2.5 sm:gap-4 sm:px-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl bg-sky-300/30 blur-md" />
              <img
                src={opengoatLogo}
                alt="OpenGoat logo"
                className="relative size-12 rounded-full shadow-[0_10px_24px_rgba(30,144,255,0.28)] sm:size-14"
              />
            </div>
            <p className="text-lg font-medium text-slate-100 sm:text-xl">
              I&apos;m Goat, your AI Co-Founder.
            </p>
          </div>
          <div className="mt-4 space-y-2 text-base text-slate-200/90 sm:text-lg">
            <p>
              I run a self-driving dev team that evolves your app every single
              day.
            </p>
            <p>
              Let&apos;s get you set up in under a minute so we can start
              shipping.
            </p>
          </div>
        </section>

        <section className="opengoat-onboard-flow mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(175deg,rgba(10,14,27,0.92)_0%,rgba(7,11,22,0.86)_100%)] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-7">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <StepTitle
                number={1}
                title="What are we building?"
                helper="One sentence is fine."
                active
              />
              <Textarea
                value={projectSummary}
                onChange={(event) => setProjectSummary(event.target.value)}
                placeholder='e.g. "A SaaS analytics dashboard for indie hackers" or "My existing fitness tracking app"'
                className="mt-3 min-h-[96px] border-white/15 bg-black/25 text-[15px] placeholder:text-slate-400"
                disabled={isBusy}
              />
            </div>

            {stepOneComplete ? (
              <div className="opengoat-onboard-reveal rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <StepTitle
                  number={2}
                  title="Is this a new app or an existing one?"
                  helper="Choose one to continue."
                  active
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ModeOption
                    selected={buildMode === "new"}
                    title="New"
                    description="Start from scratch"
                    icon={<Plus className="size-4" />}
                    onClick={() => setBuildMode("new")}
                    disabled={isBusy}
                  />
                  <ModeOption
                    selected={buildMode === "existing"}
                    title="Existing"
                    description="Just give me the GitHub URL"
                    icon={<GitBranch className="size-4" />}
                    onClick={() => setBuildMode("existing")}
                    disabled={isBusy}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-muted-foreground text-sm">
                Step 2 unlocks after you add what we are building.
              </div>
            )}

            {buildMode === "existing" ? (
              <div className="opengoat-onboard-reveal space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <StepTitle
                    number={2}
                    title="GitHub repository URL"
                    helper="Paste your repository URL."
                    active
                  />
                  <Input
                    value={githubRepoUrl}
                    onChange={(event) => setGithubRepoUrl(event.target.value)}
                    placeholder="https://github.com/owner/repository"
                    className={cn(
                      "mt-3 border-white/15 bg-black/25",
                      !repoLooksValid &&
                        "border-danger/65 focus-visible:ring-danger",
                    )}
                    disabled={isBusy}
                  />
                  {!repoLooksValid ? (
                    <p className="mt-2 text-danger text-xs">
                      Use a valid GitHub URL like
                      `https://github.com/owner/repo`.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <StepTitle
                    number={3}
                    title="Great. I see the repo. What's the #1 thing you want improved in the next 7 days?"
                    helper="Short-term goal only - no long-term vision required yet."
                    active
                  />
                  <Textarea
                    value={sevenDayGoal}
                    onChange={(event) => setSevenDayGoal(event.target.value)}
                    placeholder="e.g. Improve onboarding activation from 18% to 35%"
                    className="mt-3 min-h-[88px] border-white/15 bg-black/25"
                    disabled={isBusy}
                  />
                </div>
              </div>
            ) : null}

            {buildMode === "new" ? (
              <div className="opengoat-onboard-reveal space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <StepTitle
                    number={2}
                    title="What should we call the app?"
                    helper="I'll create the repo structure + first MVP cycle."
                    active
                  />
                  <Input
                    value={appName}
                    onChange={(event) => setAppName(event.target.value)}
                    placeholder="e.g. PulseBoard"
                    className="mt-3 border-white/15 bg-black/25"
                    disabled={isBusy}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <StepTitle
                    number={3}
                    title="What's the single most important feature for the first version?"
                    helper="MVP in one sentence."
                    active
                  />
                  <Textarea
                    value={mvpFeature}
                    onChange={(event) => setMvpFeature(event.target.value)}
                    placeholder="e.g. Shared team dashboard with real-time KPI tracking"
                    className="mt-3 min-h-[88px] border-white/15 bg-black/25"
                    disabled={isBusy}
                  />
                </div>
              </div>
            ) : null}

            <Button
              className="h-11 w-full rounded-xl border border-sky-300/35 bg-[linear-gradient(90deg,#53b5ff_0%,#4b9eff_45%,#5ecdd5_100%)] font-semibold text-[#021228] hover:brightness-110"
              disabled={!canContinue || isBusy}
              onClick={() => {
                void handleGenerateRoadmap();
              }}
            >
              {isBusy ? <Spinner className="text-[#021228]" /> : null}
              {latestAssistantMessage ? "Regenerate roadmap with Goat" : "Generate roadmap with Goat"}
              <ArrowRight className="size-4" />
            </Button>

            {isBusy ? (
              <div className="rounded-2xl border border-sky-200/25 bg-sky-400/10 p-4">
                <div className="flex items-center gap-2 text-sky-100 text-sm">
                  <Spinner className="text-sky-100" />
                  {runState === "creating-session"
                    ? "Creating your Goat session..."
                    : "Goat is reading your context and drafting the roadmap..."}
                </div>
                {progressMessages.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sky-100/85 text-xs">
                    {progressMessages.map((item, index) => (
                      <li key={`${item}:${index}`} className="truncate">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {runError ? (
              <div className="rounded-2xl border border-danger/40 bg-danger/15 p-4 text-danger text-sm">
                {runError}
              </div>
            ) : null}

            {conversation.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <p className="mb-3 font-medium text-slate-100 text-sm">
                  Roadmap session
                  {sessionInfo ? ` • ${sessionInfo.sessionRef}` : ""}
                </p>
                <div className="space-y-4">
                  {conversation.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent
                        className={
                          message.role === "assistant"
                            ? "w-full max-w-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                            : undefined
                        }
                      >
                        {message.role === "assistant" ? (
                          <MessageResponse>{message.content}</MessageResponse>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        )}
                      </MessageContent>
                    </Message>
                  ))}
                </div>
              </div>
            ) : null}

            {latestAssistantMessage && !isBusy ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <p className="font-medium text-slate-100 text-sm">
                  Is this roadmap okay, or do you want Goat to revise it?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    className="bg-emerald-400 text-[#05200f] hover:bg-emerald-300"
                    onClick={() => {
                      setRoadmapApproved(true);
                      setNeedsChangesOpen(false);
                    }}
                    type="button"
                  >
                    <CheckCircle2 className="size-4" />
                    Looks good
                  </Button>
                  <Button
                    onClick={() => {
                      setRoadmapApproved(false);
                      setNeedsChangesOpen(true);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <RefreshCcw className="size-4" />
                    Needs changes
                  </Button>
                </div>

                {roadmapApproved ? (
                  <p className="mt-3 text-emerald-200 text-sm">
                    Perfect. You can continue in this same Goat session from the dashboard.
                  </p>
                ) : null}

                {needsChangesOpen ? (
                  <div className="mt-4 space-y-3">
                    <Textarea
                      value={feedbackDraft}
                      onChange={(event) => setFeedbackDraft(event.target.value)}
                      placeholder="Tell Goat exactly what to change in the roadmap..."
                      className="min-h-[88px] border-white/15 bg-black/25"
                    />
                    <Button
                      disabled={feedbackDraft.trim().length === 0}
                      onClick={() => {
                        void handleSubmitFeedback();
                      }}
                      type="button"
                    >
                      Send changes to Goat
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function StepTitle({
  number,
  title,
  helper,
  active = false,
}: {
  number: number;
  title: string;
  helper?: string;
  active?: boolean;
}): ReactElement {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
            active
              ? "border-sky-300/45 bg-sky-300/15 text-sky-100"
              : "border-white/20 bg-white/5 text-slate-300",
          )}
        >
          {number}
        </span>
        <p className="font-medium text-sm text-slate-100">{title}</p>
      </div>
      {helper ? (
        <p className="pl-8 text-muted-foreground text-xs">{helper}</p>
      ) : null}
    </div>
  );
}

function ModeOption({
  selected,
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactElement;
  onClick: () => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      className={cn(
        "group rounded-2xl border px-4 py-3 text-left transition-colors duration-150",
        selected
          ? "border-sky-300/50 bg-sky-300/12"
          : "border-white/15 bg-black/20 hover:border-slate-300/35 hover:bg-white/[0.06]",
        disabled && "cursor-not-allowed opacity-60",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="mb-2 inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-slate-100">
        {icon}
      </div>
      <p className="font-medium text-sm text-slate-100">{title}</p>
      <p className="mt-1 text-muted-foreground text-xs">{description}</p>
    </button>
  );
}

function createMessageId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function trimAndNormalize(value: string): string {
  return value.trim();
}

function buildOnboardingSummaryForUser(input: {
  projectSummary: string;
  buildMode: BuildMode;
  githubRepoUrl: string;
  sevenDayGoal: string;
  appName: string;
  mvpFeature: string;
}): string {
  if (input.buildMode === "existing") {
    return [
      "Onboarding completed for an existing app.",
      `Project: ${input.projectSummary}`,
      `Repository: ${input.githubRepoUrl}`,
      `7-day priority: ${input.sevenDayGoal}`,
    ].join("\n");
  }

  return [
    "Onboarding completed for a new app.",
    `Project: ${input.projectSummary}`,
    `App name: ${input.appName}`,
    `MVP feature: ${input.mvpFeature}`,
  ].join("\n");
}

function buildInitialRoadmapPrompt(input: {
  projectSummary: string;
  buildMode: BuildMode;
  githubRepoUrl: string;
  sevenDayGoal: string;
  appName: string;
  mvpFeature: string;
}): string {
  const modeDetails =
    input.buildMode === "existing"
      ? [
          "- App type: Existing application",
          `- GitHub URL: ${input.githubRepoUrl}`,
          `- 7-day priority: ${input.sevenDayGoal}`,
        ].join("\n")
      : [
          "- App type: New application",
          `- Proposed app name: ${input.appName}`,
          `- First-version focus feature: ${input.mvpFeature}`,
        ].join("\n");

  return [
    "You are Goat, the AI Co-Founder.",
    "Read organization/ROADMAP.md and then define an updated 7-day roadmap based on this onboarding context.",
    "",
    "User onboarding context:",
    `- Product summary: ${input.projectSummary}`,
    modeDetails,
    "",
    "Requirements:",
    "1. Keep the roadmap concrete, short-term, and execution-focused.",
    "2. Include specific milestones for the next 7 days.",
    "3. Include assumptions/risks that could block delivery.",
    "4. Include success criteria for the week.",
    "5. End by asking: \"Is this roadmap okay, or should I revise anything?\"",
    "",
    "Output format:",
    "## Proposed Roadmap",
    "### Product Context",
    "### 7-Day Plan",
    "### Risks and Assumptions",
    "### Success Criteria",
    "### Confirmation",
  ].join("\n");
}

function buildRoadmapRevisionPrompt(feedback: string): string {
  return [
    "Revise the roadmap you proposed in this session.",
    "Use the user's feedback below and return the full updated roadmap, not a diff.",
    "",
    "User feedback:",
    feedback,
    "",
    "Keep the same structure:",
    "## Proposed Roadmap",
    "### Product Context",
    "### 7-Day Plan",
    "### Risks and Assumptions",
    "### Success Criteria",
    "### Confirmation",
    "",
    "End by asking: \"Is this roadmap okay, or should I revise anything?\"",
  ].join("\n");
}

async function sendSessionMessageStream(
  payload: {
    agentId: string;
    sessionRef: string;
    message: string;
  },
  options?: {
    onEvent?: (event: SessionMessageStreamEvent) => void;
    signal?: AbortSignal;
  },
): Promise<SessionSendMessageResponse> {
  const routes = ["/api/sessions/message/stream", "/api/session/message/stream"];
  let lastError: unknown;

  for (const routePath of routes) {
    try {
      const response = await fetch(routePath, {
        method: "POST",
        signal: options?.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const body = response.body;
      if (!body) {
        throw new Error("Streaming response body is unavailable.");
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResponse: SessionSendMessageResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const event = JSON.parse(trimmed) as SessionMessageStreamEvent;
          options?.onEvent?.(event);
          if (event.type === "error") {
            throw new Error(event.error || "Unable to send session message.");
          }
          if (event.type === "result") {
            finalResponse = {
              agentId: event.agentId,
              sessionRef: event.sessionRef,
              output: event.output,
              result: event.result,
              message: event.message,
            };
          }
        }

        if (done) {
          break;
        }
      }

      if (buffer.trim()) {
        const event = JSON.parse(buffer.trim()) as SessionMessageStreamEvent;
        options?.onEvent?.(event);
        if (event.type === "error") {
          throw new Error(event.error || "Unable to send session message.");
        }
        if (event.type === "result") {
          finalResponse = {
            agentId: event.agentId,
            sessionRef: event.sessionRef,
            output: event.output,
            result: event.result,
            message: event.message,
          };
        }
      }

      if (finalResponse) {
        return finalResponse;
      }
      throw new Error("Session message stream ended without a final result.");
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== "Not Found") {
        throw error;
      }
    }
  }

  return sendSessionMessage(payload, options?.signal);
}

async function sendSessionMessage(
  payload: {
    agentId: string;
    sessionRef: string;
    message: string;
  },
  signal?: AbortSignal,
): Promise<SessionSendMessageResponse> {
  const routes = ["/api/sessions/message", "/api/session/message"];
  let lastError: unknown;

  for (const routePath of routes) {
    try {
      return await fetchJson<SessionSendMessageResponse>(routePath, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== "Not Found") {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to send session message.");
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  const payload = (await response.json()) as T;
  return payload;
}

async function readResponseError(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;
  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    return fallback;
  }

  const normalized = bodyText.trim();
  if (!normalized) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(normalized) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Non-JSON error response.
  }

  return normalized;
}
