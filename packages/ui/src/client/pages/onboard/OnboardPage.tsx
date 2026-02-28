import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowRight, GitBranch, Plus } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import opengoatLogo from "../../../../../../assets/opengoat.png";
import {
  clearOnboardingChatState,
  loadOnboardingPayload,
  saveOnboardingPayload,
  type BuildMode,
  type OnboardingPayload,
} from "./shared";

type BuildModeSelection = BuildMode | null;

export function OnboardPage(): ReactElement {
  const initialPayload = useMemo(() => loadOnboardingPayload(), []);
  const initialBuildMode: BuildModeSelection =
    initialPayload?.buildMode === "new" || initialPayload?.buildMode === "existing"
      ? initialPayload.buildMode
      : null;
  const [projectSummary, setProjectSummary] = useState(
    initialPayload?.projectSummary ?? "",
  );
  const [buildMode, setBuildMode] = useState<BuildModeSelection>(initialBuildMode);
  const [githubRepoUrl, setGithubRepoUrl] = useState(
    initialPayload?.githubRepoUrl ?? "",
  );
  const [sevenDayGoal, setSevenDayGoal] = useState(
    initialPayload?.sevenDayGoal ?? "",
  );
  const [appName, setAppName] = useState(initialPayload?.appName ?? "");
  const [mvpFeature, setMvpFeature] = useState(
    initialPayload?.mvpFeature ?? "",
  );

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

  function handleStartRoadmapChat(): void {
    if (!canContinue || buildMode === null) {
      return;
    }

    const payload: OnboardingPayload = {
      projectSummary: projectSummary.trim(),
      buildMode,
      githubRepoUrl: githubRepoUrl.trim(),
      sevenDayGoal: sevenDayGoal.trim(),
      appName: appName.trim(),
      mvpFeature: mvpFeature.trim(),
    };
    saveOnboardingPayload(payload);
    clearOnboardingChatState();
    window.location.assign("/onboard/connect");
  }

  return (
    <main
      className="opengoat-onboard-shell relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_-5%,rgba(91,141,255,0.2),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(38,213,184,0.14),transparent_34%),linear-gradient(160deg,#06070d_0%,#0a1121_46%,#06080f_100%)] text-foreground"
      style={{
        fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
      }}
    >
      <div className="-left-20 absolute top-20 size-72 rounded-full bg-sky-400/12 blur-3xl" />
      <div className="absolute bottom-16 right-0 size-72 rounded-full bg-cyan-300/10 blur-3xl" />
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
                  />
                  <ModeOption
                    selected={buildMode === "existing"}
                    title="Existing"
                    description="Just give me the GitHub URL"
                    icon={<GitBranch className="size-4" />}
                    onClick={() => setBuildMode("existing")}
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
                  />
                </div>
              </div>
            ) : null}

            <Button
              className="h-11 w-full rounded-xl border border-sky-300/35 bg-[linear-gradient(90deg,#53b5ff_0%,#4b9eff_45%,#5ecdd5_100%)] font-semibold text-[#021228] hover:brightness-110"
              disabled={!canContinue}
              onClick={handleStartRoadmapChat}
            >
              Continue setup
              <ArrowRight className="size-4" />
            </Button>
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
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactElement;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      className={cn(
        "group rounded-2xl border px-4 py-3 text-left transition-colors duration-150",
        selected
          ? "border-sky-300/50 bg-sky-300/12"
          : "border-white/15 bg-black/20 hover:border-slate-300/35 hover:bg-white/[0.06]",
      )}
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
