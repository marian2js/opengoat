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

export function buildOnboardingSummaryForUser(input: OnboardingPayload): string {
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

export function buildInitialRoadmapPrompt(input: OnboardingPayload): string {
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
    "Read organization/ROADMAP.md and define an updated 7-day roadmap based on this onboarding context.",
    "",
    "User onboarding context:",
    `- Product summary: ${input.projectSummary}`,
    modeDetails,
    "",
    "Requirements:",
    "1. Keep the roadmap concrete, short-term, and execution-focused.",
    "2. Include specific milestones for the next 7 days.",
    "3. Include assumptions and risks that could block delivery.",
    "4. Include measurable success criteria for the week.",
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

export function normalizeRunError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("device signature invalid") ||
    lower.includes("gateway connect failed")
  ) {
    return "OpenClaw gateway auth failed for this device. Run `openclaw onboard`, then retry.";
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
    const parsed = JSON.parse(normalized) as { error?: unknown; message?: unknown };
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
