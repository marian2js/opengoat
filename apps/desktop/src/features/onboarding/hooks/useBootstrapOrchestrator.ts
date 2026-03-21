import { useCallback, useRef, useState } from "react";
import type { BootstrapPrompt } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_READY_POLL_MS = 1_500;
const AGENT_READY_MAX_ATTEMPTS = 8;

/**
 * Poll the sidecar until the gateway has fully registered the agent.
 * A newly created agent may take a moment to propagate to the embedded
 * gateway; without this check the first chat request would fail with 500.
 */
async function waitForAgentReady(
  client: SidecarClient,
  agentId: string,
): Promise<void> {
  for (let attempt = 0; attempt < AGENT_READY_MAX_ATTEMPTS; attempt++) {
    try {
      // A lightweight probe: creating an internal session verifies the
      // gateway knows about the agent and can allocate resources for it.
      await client.createSession({ agentId, internal: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, AGENT_READY_POLL_MS));
    }
  }
  // Give up waiting — the orchestrator will surface any downstream errors.
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BootstrapStepStatus =
  | "pending"
  | "streaming"
  | "verifying"
  | "completed"
  | "error";

export interface BootstrapStep {
  id: string;
  label: string;
  expectedFile: string;
  status: BootstrapStepStatus;
  streamedText: string;
  error?: string | undefined;
}

export type BootstrapOverallStatus =
  | "idle"
  | "loading-prompts"
  | "running"
  | "completed"
  | "error";

export interface BootstrapState {
  status: BootstrapOverallStatus;
  steps: BootstrapStep[];
  currentStepIndex: number;
  error?: string | undefined;
}

export interface UseBootstrapOrchestratorReturn {
  state: BootstrapState;
  start: (agentId: string, projectUrl: string) => Promise<void>;
  retry: () => Promise<void>;
  cancel: () => void;
}

// ---------------------------------------------------------------------------
// Step labels (user-facing)
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<string, string> = {
  product: "Analyzing your product",
  market: "Researching the market",
  growth: "Building growth strategy",
};

// ---------------------------------------------------------------------------
// Stream parsing
// ---------------------------------------------------------------------------

/**
 * Reads the UI Message Stream (SSE) response and extracts text deltas.
 *
 * The sidecar streams using SSE format:
 *   `data: {"type":"start","messageId":"..."}\n`
 *   `data: {"type":"text-delta","delta":"chunk","id":"..."}\n`
 *   `data: {"type":"text-end","id":"..."}\n`
 *   `data: {"type":"finish","finishReason":"stop"}\n`
 *
 * We extract `delta` values from `text-delta` events for display.
 */
export async function readStreamTextDeltas(
  response: Response,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const body = response.body;
  if (!body) {
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // SSE data lines: `data: {...}`
        if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (payload.type === "text-delta" && typeof payload.delta === "string") {
              onDelta(payload.delta);
            }
          } catch {
            // Malformed SSE event — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const MAX_RETRIES_PER_STEP = 1;

function createInitialState(): BootstrapState {
  return {
    status: "idle",
    steps: [],
    currentStepIndex: 0,
  };
}

function promptToStep(prompt: BootstrapPrompt): BootstrapStep {
  return {
    id: prompt.id,
    label: STEP_LABELS[prompt.id] ?? prompt.name,
    expectedFile: prompt.expectedFile,
    status: "pending",
    streamedText: "",
  };
}

export function useBootstrapOrchestrator(
  client: SidecarClient | null,
): UseBootstrapOrchestratorReturn {
  const [state, setState] = useState<BootstrapState>(createInitialState);
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef<{ agentId: string; projectUrl: string; prompts: BootstrapPrompt[] } | null>(null);

  const updateStep = useCallback(
    (index: number, patch: Partial<BootstrapStep>) => {
      setState((prev) => ({
        ...prev,
        steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
      }));
    },
    [],
  );

  const runStep = useCallback(
    async (
      sidecar: SidecarClient,
      agentId: string,
      prompt: BootstrapPrompt,
      stepIndex: number,
      signal: AbortSignal,
    ): Promise<boolean> => {
      // Create an internal session for this bootstrap prompt
      const session = await sidecar.createSession({
        agentId,
        internal: true,
      });

      // Update UI to streaming state
      setState((prev) => ({
        ...prev,
        currentStepIndex: stepIndex,
      }));
      updateStep(stepIndex, { status: "streaming", streamedText: "", error: undefined });

      // Send the prompt and stream the response
      const response = await sidecar.sendChatMessage(
        { agentId, message: prompt.message, sessionId: session.id },
        signal,
      );

      await readStreamTextDeltas(
        response,
        (delta) => {
          updateStep(stepIndex, {
            streamedText: undefined as unknown as string, // handled below
          });
          // Use functional setState to safely append to streamedText
          setState((prev) => ({
            ...prev,
            steps: prev.steps.map((step, i) =>
              i === stepIndex ? { ...step, streamedText: step.streamedText + delta } : step,
            ),
          }));
        },
        signal,
      );

      // Verify file was created
      updateStep(stepIndex, { status: "verifying" });
      const check = await sidecar.checkWorkspaceFile(agentId, prompt.expectedFile);
      return check.exists;
    },
    [updateStep],
  );

  const runBootstrap = useCallback(
    async (startFromIndex = 0) => {
      const sidecar = client;
      const ctx = contextRef.current;
      if (!sidecar || !ctx) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, status: "running", error: undefined }));

      try {
        for (let i = startFromIndex; i < ctx.prompts.length; i++) {
          if (controller.signal.aborted) {
            return;
          }

          const prompt = ctx.prompts[i]!;
          let success = false;

          for (let attempt = 0; attempt <= MAX_RETRIES_PER_STEP; attempt++) {
            if (controller.signal.aborted) {
              return;
            }

            try {
              success = await runStep(sidecar, ctx.agentId, prompt, i, controller.signal);
            } catch (stepError) {
              // Treat exceptions (500s, network errors) the same as a
              // failed file check — log and fall through to the retry /
              // error path instead of aborting the entire bootstrap.
              console.error(
                `Bootstrap step "${prompt.id}" attempt ${String(attempt + 1)} failed:`,
                stepError,
              );
              const errorMsg =
                stepError instanceof Error ? stepError.message : "Unexpected error";
              updateStep(i, { error: errorMsg });
              success = false;
            }

            if (success) {
              break;
            }
          }

          if (!success) {
            updateStep(i, {
              status: "error",
              error: `Failed to create ${prompt.expectedFile} after ${String(MAX_RETRIES_PER_STEP + 1)} attempts. `
                + "This can happen with smaller or free-tier models that struggle with complex instructions. "
                + "Try again, or switch to a more capable model.",
            });
            setState((prev) => ({
              ...prev,
              status: "error",
              error: `Failed to create ${prompt.expectedFile}. You can retry or switch to a more capable model.`,
            }));
            return;
          }

          updateStep(i, { status: "completed" });
        }

        // Final gate: independently verify that ALL expected files exist
        // before declaring success. This catches edge cases where individual
        // step checks passed but files were later removed or never flushed.
        for (let i = 0; i < ctx.prompts.length; i++) {
          const prompt = ctx.prompts[i]!;
          const check = await sidecar.checkWorkspaceFile(ctx.agentId, prompt.expectedFile);
          if (!check.exists) {
            updateStep(i, {
              status: "error",
              error: `${prompt.expectedFile} was not found during final verification.`,
            });
            setState((prev) => ({
              ...prev,
              status: "error",
              error: `${prompt.expectedFile} is missing. Please retry setup.`,
            }));
            return;
          }
        }

        setState((prev) => ({ ...prev, status: "completed" }));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
      }
    },
    [client, runStep, updateStep],
  );

  const start = useCallback(
    async (agentId: string, projectUrl: string) => {
      if (!client) {
        return;
      }

      setState((prev) => ({ ...prev, status: "loading-prompts" }));

      try {
        // Wait briefly for the gateway to fully register the new agent.
        // Without this, the first chat request can fail with a 500 because
        // the gateway hasn't synced the agent's workspace yet.
        await waitForAgentReady(client, agentId);

        const { prompts } = await client.getBootstrapPrompts(agentId, projectUrl);
        const steps = prompts.map(promptToStep);

        contextRef.current = { agentId, projectUrl, prompts };
        setState({
          status: "running",
          steps,
          currentStepIndex: 0,
        });

        await runBootstrap(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load bootstrap prompts.";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
      }
    },
    [client, runBootstrap],
  );

  const retry = useCallback(async () => {
    const steps = state.steps;
    const firstIncomplete = steps.findIndex((s) => s.status !== "completed");
    if (firstIncomplete === -1) {
      return;
    }

    await runBootstrap(firstIncomplete);
  }, [state.steps, runBootstrap]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { state, start, retry, cancel };
}
