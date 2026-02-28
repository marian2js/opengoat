export type BuildMode = "new" | "existing";

export interface OnboardingPayload {
  projectSummary: string;
  buildMode: BuildMode;
  githubRepoUrl: string;
  sevenDayGoal: string;
  appName: string;
  mvpFeature: string;
}

export interface OnboardingSessionInfo {
  agentId: string;
  sessionRef: string;
  sessionId: string;
}

export interface OnboardingChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface OnboardingChatState {
  sessionInfo: OnboardingSessionInfo | null;
  messages: OnboardingChatMessage[];
  hasInitialRoadmapRequest: boolean;
}

export interface WorkspaceSessionResponse {
  agentId: string;
  session: {
    sessionKey: string;
    sessionId: string;
  };
  message?: string;
}

export interface SessionSendMessageResponse {
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

const ONBOARDING_PAYLOAD_KEY = "opengoat:onboard:payload";
const ONBOARDING_CHAT_STATE_KEY = "opengoat:onboard:chat-state";
export const ONBOARDING_START_MARKER = "{{START}}";
const ONBOARDING_START_MARKER_REGEX = /(?:^|\n)\s*\{\{START\}\}\s*$/u;

export const DEFAULT_AGENT_ID = "goat";
export const ONBOARDING_WORKSPACE_NAME = "Onboarding Roadmap";

export function saveOnboardingPayload(payload: OnboardingPayload): void {
  sessionStorage.setItem(ONBOARDING_PAYLOAD_KEY, JSON.stringify(payload));
}

export function loadOnboardingPayload(): OnboardingPayload | null {
  const raw = sessionStorage.getItem(ONBOARDING_PAYLOAD_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as OnboardingPayload;
    if (!parsed || typeof parsed.projectSummary !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOnboardingPayload(): void {
  sessionStorage.removeItem(ONBOARDING_PAYLOAD_KEY);
}

export function saveOnboardingChatState(state: OnboardingChatState): void {
  sessionStorage.setItem(ONBOARDING_CHAT_STATE_KEY, JSON.stringify(state));
}

export function loadOnboardingChatState(): OnboardingChatState {
  const raw = sessionStorage.getItem(ONBOARDING_CHAT_STATE_KEY);
  if (!raw) {
    return {
      sessionInfo: null,
      messages: [],
      hasInitialRoadmapRequest: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as OnboardingChatState;
    return {
      sessionInfo: parsed.sessionInfo ?? null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      hasInitialRoadmapRequest: parsed.hasInitialRoadmapRequest === true,
    };
  } catch {
    return {
      sessionInfo: null,
      messages: [],
      hasInitialRoadmapRequest: false,
    };
  }
}

export function clearOnboardingChatState(): void {
  sessionStorage.removeItem(ONBOARDING_CHAT_STATE_KEY);
}

export function createMessageId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function buildOnboardingSummaryForUser(
  input: OnboardingPayload,
): string {
  const projectName =
    input.buildMode === "existing"
      ? input.projectSummary
      : input.appName || input.projectSummary;

  return [
    `✅ Onboarding complete!`,
    ``,
    `Project: ${projectName}`,
    input.buildMode === "existing"
      ? `Repository: ${input.githubRepoUrl}`
      : `New app: ${input.appName}`,
    ``,
    input.buildMode === "existing"
      ? `Short-term focus: ${input.sevenDayGoal}`
      : `MVP focus: ${input.mvpFeature}`,
    ``,
    `I'm now generating your initial roadmap based on everything you told me...`,
  ].join("\n");
}

export function buildInitialRoadmapPrompt(input: OnboardingPayload): string {
  const modeDetails =
    input.buildMode === "existing"
      ? [
          `- App type: Existing application`,
          `- GitHub repository: ${input.githubRepoUrl}`,
          `- Next priorities: ${input.sevenDayGoal}`,
        ].join("\n")
      : [
          `- App type: New application`,
          `- Proposed app name: ${input.appName}`,
          `- First-version focus: ${input.mvpFeature}`,
        ].join("\n");

  return [
    `You are Goat, the AI Co-Founder of this product.`,
    `You are visionary, strategic, warm, and decisive.`,
    ``,
    `Read organization/ROADMAP.md file and update it based on this data:`,
    ``,
    `- Product summary: ${input.projectSummary}`,
    modeDetails,
    ``,
    `Rules for the roadmap:`,
    `- Use **phases**, never time-based horizons. You can create any number of phases. Each phase has N initiatives`,
    `- Every initiative must be high-level (epic/story only — never small tasks or tickets)`,
    `- Every initiative needs a clear, measurable outcome`,
    `- Be ambitious but realistic`,
    `- Strongly align with the long-term vision and short-term goals the user gave`,
    `- Phase 1 must deliver real user value quickly`,
    ``,
    ...buildOnboardingStartMarkerProtocolLines(),
  ].join("\n");
}

export function buildOnboardingFollowUpPrompt(userMessage: string): string {
  const normalizedMessage = userMessage.trim();
  return [
    normalizedMessage,
    ``,
    ...buildOnboardingStartMarkerProtocolLines(),
  ].join("\n");
}

export function parseOnboardingAssistantOutput(output: string): {
  cleanedContent: string;
  shouldRedirectToDashboard: boolean;
} {
  const trimmedOutput = output.trim();
  if (!trimmedOutput) {
    return {
      cleanedContent: "",
      shouldRedirectToDashboard: false,
    };
  }

  if (!ONBOARDING_START_MARKER_REGEX.test(trimmedOutput)) {
    return {
      cleanedContent: trimmedOutput,
      shouldRedirectToDashboard: false,
    };
  }

  return {
    cleanedContent: trimmedOutput
      .replace(ONBOARDING_START_MARKER_REGEX, "")
      .trim(),
    shouldRedirectToDashboard: true,
  };
}

export function normalizeRunError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("device signature invalid") ||
    lower.includes("gateway connect failed")
  ) {
    return "OpenClaw gateway auth failed for this device. Run `openclaw onboard`, then retry.";
  }
  if (
    (lower.includes("plugins.entries.") &&
      lower.includes("plugin not found")) ||
    lower.includes("stale config entry ignored")
  ) {
    return "OpenClaw has stale plugin config warnings. Run `openclaw onboard` to refresh plugin config, then retry.";
  }
  return message;
}

export async function sendSessionMessageStream(
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
  const routes = [
    "/api/sessions/message/stream",
    "/api/session/message/stream",
  ];
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

export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
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
    const parsed = JSON.parse(normalized) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Non-JSON response.
  }

  return normalized;
}

function buildOnboardingStartMarkerProtocolLines(): string[] {
  return [
    `Conversation protocol:`,
    `- When the user explicitly approves the roadmap and wants to begin execution, end your response with ${ONBOARDING_START_MARKER} on its own final line.`,
    `- Never output ${ONBOARDING_START_MARKER} unless the user is clearly approving and ready to start.`,
  ];
}
