import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
  XIcon,
} from "lucide-react";
import alibabaCloudLogo from "simple-icons/icons/alibabacloud.svg?raw";
import baiduLogo from "simple-icons/icons/baidu.svg?raw";
import anthropicLogo from "simple-icons/icons/anthropic.svg?raw";
import bytedanceLogo from "simple-icons/icons/bytedance.svg?raw";
import cloudflareLogo from "simple-icons/icons/cloudflare.svg?raw";
import githubCopilotLogo from "simple-icons/icons/githubcopilot.svg?raw";
import googleGeminiLogo from "simple-icons/icons/googlegemini.svg?raw";
import huggingFaceLogo from "simple-icons/icons/huggingface.svg?raw";
import minimaxLogo from "simple-icons/icons/minimax.svg?raw";
import mistralLogo from "simple-icons/icons/mistralai.svg?raw";
import ollamaLogo from "simple-icons/icons/ollama.svg?raw";
import openRouterLogo from "simple-icons/icons/openrouter.svg?raw";
import vercelLogo from "simple-icons/icons/vercel.svg?raw";
import xLogo from "simple-icons/icons/x.svg?raw";
import xiaomiLogo from "simple-icons/icons/xiaomi.svg?raw";
// Inline SVGs for providers not available in simple-icons
const openaiLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z"/></svg>`;
const chutesLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-1.5 4h3v3.5L12 11l-1.5-1.5zm-3 3h3v3.5L9 14l-1.5-1.5zm6 0h3v3.5L15 14l-1.5-1.5zM7.5 12.5h3V16L9 17.5l-1.5-1.5zm6 0h3V16l-1.5 1.5-1.5-1.5z"/></svg>`;
const moonshotLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 2a8 8 0 0 1 5.29 2C14.76 5.2 12 8.04 12 11.5c0 2.9 1.87 5.37 4.47 6.27A7.97 7.97 0 0 1 12 20a8 8 0 0 1 0-16"/></svg>`;
const volcengineLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5L18.5 20h-13L12 6.5z"/></svg>`;
const kilocodeLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h4v16H4zm6 0h2v7.2L18 4h4l-7.2 8L22 20h-4l-6-7.2V20h-2z"/></svg>`;
const qwenLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.73 0 3.36-.44 4.78-1.22l2.83 2.83 1.41-1.41-2.5-2.5A9.96 9.96 0 0 0 22 12c0-5.52-4.48-10-10-10m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16m0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12"/></svg>`;
const zaiLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v3H9.5L20 17v3H4v-3h10.5L4 7z"/></svg>`;
const opencodeLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6z"/></svg>`;
const syntheticLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
const veniceLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 12h4v8h12v-8h4L12 2zm0 3.5L18 12h-2v6H8v-6H6l6-6.5z"/></svg>`;
const togetherLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6m10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6M7 23a3 3 0 1 1 0-6 3 3 0 0 1 0 6m10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6M4 13.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m16 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m-8-2.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5"/></svg>`;
const litellmLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M13 3v14h-2V3h2m5 4v10h-2V7h2M8 11v6H6v-6h2"/></svg>`;
const customProviderLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.14 12.94a7 7 0 0 0 .06-.94 7 7 0 0 0-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54a7 7 0 0 0-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58a7 7 0 0 0-.06.94 7 7 0 0 0 .06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54a7 7 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2"/></svg>`;
const sglangLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17.5 7.2c-.4-1.6-1.8-2.7-3.5-2.7-1.3 0-2.4.7-3.1 1.7C9.2 6.1 7.5 7.6 7.5 9.5c0 .2 0 .3.1.5C6.1 10.3 5 11.5 5 13c0 1.8 1.5 3.2 3.3 3.2h8.4c1.5 0 2.8-1.2 2.8-2.8 0-1.3-.9-2.4-2.2-2.7l.1-.7c0-1.2-.7-2.3-1.7-2.8zM5 17.5h14v1H5z"/></svg>`;
const vllmLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4l5 16h2l3-10 3 10h2l5-16h-3l-3.5 12L14 4h-4l-2.5 12L4 4z"/></svg>`;
import type {
  AuthOverview,
  AuthSession,
  ProviderDefinition,
  ProviderModelCatalog,
} from "@/app/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { openExternalUrl } from "@/lib/platform/open-external-url";
import { SidecarClient } from "@/lib/sidecar/client";

interface ConnectionCenterProps {
  authOverview: AuthOverview | null;
  client: SidecarClient | null;
  isLoading: boolean;
  onClose?: () => void;
  onAuthOverviewChange: (nextOverview: AuthOverview) => void;
  onContinue: (projectUrl?: string) => void | Promise<void>;
  onRetry: () => void;
  runtimeError: string | null;
}

type SetupStep = "providers" | "configure" | "website";

const providerLogos: Partial<Record<string, { color: string; darkColor?: string; svg: string }>> = {
  "ai-gateway": { color: "#111111", darkColor: "#e0e0e0", svg: vercelLogo },
  "cloudflare-ai-gateway": { color: "#F38020", svg: cloudflareLogo },
  anthropic: { color: "#191919", darkColor: "#e8e8e8", svg: anthropicLogo },
  byteplus: { color: "#111111", darkColor: "#e0e0e0", svg: bytedanceLogo },
  chutes: { color: "#111111", darkColor: "#e0e0e0", svg: chutesLogo },
  copilot: { color: "#171515", darkColor: "#e0e0e0", svg: githubCopilotLogo },
  custom: { color: "#111111", darkColor: "#e0e0e0", svg: customProviderLogo },
  google: { color: "#4285F4", svg: googleGeminiLogo },
  huggingface: { color: "#FFD21E", svg: huggingFaceLogo },
  kilocode: { color: "#111111", darkColor: "#e0e0e0", svg: kilocodeLogo },
  litellm: { color: "#111111", darkColor: "#e0e0e0", svg: litellmLogo },
  minimax: { color: "#111111", darkColor: "#e0e0e0", svg: minimaxLogo },
  mistral: { color: "#FF7000", svg: mistralLogo },
  modelstudio: { color: "#FF6A00", svg: alibabaCloudLogo },
  moonshot: { color: "#111111", darkColor: "#e0e0e0", svg: moonshotLogo },
  ollama: { color: "#111111", darkColor: "#e0e0e0", svg: ollamaLogo },
  openai: { color: "#111111", darkColor: "#e0e0e0", svg: openaiLogo },
  "openai-codex": { color: "#111111", darkColor: "#e0e0e0", svg: openaiLogo },
  opencode: { color: "#111111", darkColor: "#e0e0e0", svg: opencodeLogo },
  openrouter: { color: "#111111", darkColor: "#e0e0e0", svg: openRouterLogo },
  qianfan: { color: "#2932E1", svg: baiduLogo },
  qwen: { color: "#6F3BF5", svg: qwenLogo },
  sglang: { color: "#111111", darkColor: "#e0e0e0", svg: sglangLogo },
  synthetic: { color: "#111111", darkColor: "#e0e0e0", svg: syntheticLogo },
  together: { color: "#111111", darkColor: "#e0e0e0", svg: togetherLogo },
  venice: { color: "#111111", darkColor: "#e0e0e0", svg: veniceLogo },
  vllm: { color: "#111111", darkColor: "#e0e0e0", svg: vllmLogo },
  volcengine: { color: "#111111", darkColor: "#e0e0e0", svg: volcengineLogo },
  xai: { color: "#111111", darkColor: "#e0e0e0", svg: xLogo },
  xiaomi: { color: "#FF6900", svg: xiaomiLogo },
  zai: { color: "#111111", darkColor: "#e0e0e0", svg: zaiLogo },
};

export function ConnectionCenter({
  authOverview,
  client,
  isLoading,
  onClose,
  onAuthOverviewChange,
  onContinue,
  onRetry,
  runtimeError,
}: ConnectionCenterProps) {
  const providers = useMemo(() => authOverview?.providers ?? [], [authOverview?.providers]);
  const [step, setStep] = useState<SetupStep>(
    authOverview?.selectedProviderId ? "website" : "providers",
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [sessionInputValue, setSessionInputValue] = useState("");
  const [sessionSelections, setSessionSelections] = useState<string[]>([]);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ProviderModelCatalog | null>(null);
  const [selectedModelRef, setSelectedModelRef] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteUrlError, setWebsiteUrlError] = useState<string | null>(null);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const openedAuthLinkRef = useRef<string | null>(null);
  const handledCompletedSessionRef = useRef<string | null>(null);

  const connectedProviderIds = useMemo(
    () => new Set((authOverview?.connections ?? []).map((connection) => connection.providerId)),
    [authOverview],
  );
  const canContinue = Boolean(authOverview?.selectedProviderId);

  // Skip straight to the website step when a provider is already connected
  const didAutoSkipRef = useRef(false);
  useEffect(() => {
    if (!didAutoSkipRef.current && authOverview?.selectedProviderId && !onClose) {
      didAutoSkipRef.current = true;
      setStep("website");
    }
  }, [authOverview?.selectedProviderId, onClose]);

  useEffect(() => {
    if (providers.length === 0) {
      setSelectedProviderId(null);
      return;
    }

    const preferred =
      providers.find((provider) =>
        provider.methods.some((method) => method.providerId === authOverview?.selectedProviderId),
      ) ?? providers[0];
    if (!preferred) {
      return;
    }

    setSelectedProviderId((current) =>
      current && providers.some((provider) => provider.id === current) ? current : preferred.id,
    );
  }, [authOverview?.selectedProviderId, providers]);

  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null;

  useEffect(() => {
    if (!selectedProvider) {
      setSelectedMethodId(null);
      return;
    }

    setSelectedMethodId((current) =>
      current && selectedProvider.methods.some((method) => method.id === current)
        ? current
        : selectedProvider.methods[0]?.id ?? null,
    );
  }, [selectedProvider]);

  const selectedMethod =
    selectedProvider?.methods.find((method) => method.id === selectedMethodId) ??
    selectedProvider?.methods[0] ??
    null;

  useEffect(() => {
    if (!client || !selectedMethod) {
      setModelCatalog(null);
      setSelectedModelRef("");
      return;
    }

    let cancelled = false;
    const runtimeClient = client;
    const runtimeMethod = selectedMethod;

    async function loadProviderModels(): Promise<void> {
      try {
        const catalog = await runtimeClient.providerModels(runtimeMethod.providerId);
        if (cancelled) {
          return;
        }
        setErrorMessage(null);
        setModelCatalog(catalog);
        setSelectedModelRef(catalog.currentModelRef ?? catalog.models[0]?.modelRef ?? "");
      } catch (error) {
        if (!cancelled) {
          setModelCatalog(null);
          setSelectedModelRef("");
          setErrorMessage(getErrorMessage(error));
        }
      }
    }

    void loadProviderModels();

    return () => {
      cancelled = true;
    };
  }, [client, selectedMethod]);

  useEffect(() => {
    if (!client || authSession?.state !== "pending") {
      return;
    }

    let cancelled = false;

    const syncSession = async (): Promise<void> => {
      try {
        const nextSession = await client.getAuthSession(authSession.id);
        if (cancelled) {
          return;
        }
        setAuthSession(nextSession);

        if (nextSession.step.type === "auth_link") {
          const authLinkKey = `${nextSession.id}:${nextSession.step.url}`;
          if (openedAuthLinkRef.current !== authLinkKey) {
            openedAuthLinkRef.current = authLinkKey;
            await openExternalUrl(nextSession.step.url);
          }
        }

        if (nextSession.state === "completed") {
          if (handledCompletedSessionRef.current === nextSession.id) {
            return;
          }
          handledCompletedSessionRef.current = nextSession.id;
          let nextOverview: AuthOverview;
          if (selectedMethod && selectedModelRef.trim()) {
            nextOverview = await client.setProviderModel(
              selectedMethod.providerId,
              selectedModelRef.trim(),
            );
          } else {
            nextOverview = await client.authOverview();
          }
          const nextCatalog = selectedMethod
            ? await client.providerModels(selectedMethod.providerId)
            : null;
          onAuthOverviewChange(nextOverview);
          setModelCatalog(nextCatalog);
          setSelectedModelRef(nextCatalog?.currentModelRef ?? selectedModelRef);
          setFeedback(
            nextSession.connection
              ? `Connected ${nextSession.connection.providerName}.`
              : `${nextSession.providerName} is ready.`,
          );
          setSessionInputValue("");
          setSessionSelections([]);
          if (onClose) {
            onContinue();
          } else {
            setStep("website");
          }
        }

        if (nextSession.state === "error") {
          setErrorMessage(nextSession.error ?? "Could not complete the connection.");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      }
    };

    void syncSession();
    const timer = window.setInterval(() => {
      void syncSession();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authSession, client, onAuthOverviewChange, selectedMethod, selectedModelRef]);

  async function handleSecretConnect(): Promise<void> {
    if (!client || !selectedMethod) {
      return;
    }

    setErrorMessage(null);
    setFeedback(null);
    setIsBusy(true);

    try {
      const connection = await client.connectProviderSecret({
        authChoice: selectedMethod.id,
        secret: secret.trim(),
      });
      const nextOverview = selectedModelRef.trim()
        ? await client.setProviderModel(selectedMethod.providerId, selectedModelRef.trim())
        : await client.authOverview();
      const nextCatalog = await client.providerModels(selectedMethod.providerId);
      startTransition(() => {
        onAuthOverviewChange(nextOverview);
        setModelCatalog(nextCatalog);
        setSelectedModelRef(nextCatalog.currentModelRef ?? selectedModelRef);
        setSecret("");
      });
      setFeedback(`Connected ${connection.providerName}.`);
      if (onClose) {
        onContinue();
      } else {
        setStep("website");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStartAuthSession(): Promise<void> {
    if (!client || !selectedMethod) {
      return;
    }

    setErrorMessage(null);
    setFeedback(null);
    setIsBusy(true);

    try {
      const session = await client.startAuthSession({
        authChoice: selectedMethod.id,
      });
      openedAuthLinkRef.current = null;
      handledCompletedSessionRef.current = null;
      setSessionInputValue("");
      setSessionSelections([]);
      setAuthSession(session);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRespondToSession(
    valueOverride?: boolean | string | string[],
  ): Promise<void> {
    if (!client || !authSession) {
      return;
    }

    setErrorMessage(null);
    setIsBusy(true);

    try {
      const step = authSession.step;
      const value = valueOverride ?? (
        step.type === "confirm_prompt"
          ? true
          : step.type === "select_prompt"
            ? step.allowMultiple
              ? sessionSelections
              : sessionSelections[0] ?? ""
            : sessionInputValue
      );
      const nextSession = await client.respondToAuthSession(authSession.id, value);
      setAuthSession(nextSession);
      if (step.type === "text_prompt") {
        setSessionInputValue("");
      }
      if (step.type === "select_prompt") {
        setSessionSelections([]);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function resetToProviders(): void {
    openedAuthLinkRef.current = null;
    handledCompletedSessionRef.current = null;
    setAuthSession(null);
    setErrorMessage(null);
    setFeedback(null);
    setSecret("");
    setSessionInputValue("");
    setSessionSelections([]);
    setModelCatalog(null);
    setSelectedModelRef("");
    setStep("providers");
  }

  function selectProvider(provider: ProviderDefinition): void {
    setSelectedProviderId(provider.id);
    setSelectedMethodId(provider.methods[0]?.id ?? null);
    openedAuthLinkRef.current = null;
    handledCompletedSessionRef.current = null;
    setAuthSession(null);
    setErrorMessage(null);
    setFeedback(null);
    setSecret("");
    setSessionInputValue("");
    setSessionSelections([]);
    setModelCatalog(null);
    setSelectedModelRef("");
    setStep("configure");
  }

  return (
    <main className="relative min-h-screen bg-background px-5 py-6 text-foreground lg:px-10 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
              OpenGoat
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground lg:text-4xl">
              {step === "providers"
                ? "Connect a provider"
                : step === "website"
                  ? "Your product"
                  : selectedProvider?.name ?? "Connection"}
            </h1>
            <p className="mt-2 max-w-xl text-[14px] leading-7 text-muted-foreground">
              {step === "providers"
                ? "Choose the model provider you want to use. You can always add more later."
                : step === "website"
                  ? "Tell us about the product you want to market."
                  : selectedProvider?.description ??
                    "Choose how you want to connect, then finish setup."}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {step === "configure" || step === "website" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-md text-[12px]"
                onClick={() => {
                  if (step === "website") {
                    setStep("configure");
                  } else {
                    resetToProviders();
                  }
                }}
              >
                <ArrowLeftIcon className="size-3.5" />
                Back
              </Button>
            ) : null}
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-md text-[12px]"
                onClick={onClose}
              >
                <XIcon className="size-3.5" />
                Close
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-md text-[12px] text-muted-foreground"
              disabled={!client || isBusy || isLoading}
              onClick={() => {
                setErrorMessage(null);
                setFeedback(null);
                onRetry();
              }}
            >
              <RefreshCcwIcon className="size-3.5" />
              Retry
            </Button>
          </div>
        </header>

        <div className="mt-8 flex flex-1 flex-col gap-5">
          {runtimeError ? (
            <Banner tone="error">
              Couldn&apos;t load connection setup. Retry to continue.
            </Banner>
          ) : null}

          {errorMessage ? <Banner tone="error">{errorMessage}</Banner> : null}
          {feedback ? <Banner tone="success">{feedback}</Banner> : null}

          {isLoading && !authOverview ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" />
                Loading providers
              </div>
            </div>
          ) : step === "providers" ? (
            <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={cn(
                    "group rounded-lg border bg-card p-4 text-left transition-all duration-150 hover:bg-accent",
                    connectedProviderIds.has(resolveProviderConnectionId(provider))
                      ? "border-success/30"
                      : "border-border/60 hover:border-primary/30",
                  )}
                  onClick={() => {
                    selectProvider(provider);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ProviderMark provider={provider} />
                      <div>
                        <div className="text-[15px] font-semibold tracking-tight text-foreground">
                          {formatProviderName(provider)}
                        </div>
                        {provider.description ? (
                          <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                            {provider.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {connectedProviderIds.has(resolveProviderConnectionId(provider)) ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        <CheckIcon className="size-3" />
                        Connected
                      </span>
                    ) : null}
                  </div>

                  {provider.methods.length > 1 ? (
                    <p className="mt-3 text-[11px] text-muted-foreground/50">
                      {provider.methods.length} connection methods
                    </p>
                  ) : null}
                </button>
              ))}
            </section>
          ) : step === "configure" && selectedProvider && selectedMethod ? (
            <section className="flex flex-1 flex-col">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <ProviderMark provider={selectedProvider} />
                  <div>
                    <div className="text-xl font-semibold tracking-tight text-foreground">
                      {formatProviderName(selectedProvider)}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Choose your connection method.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedProvider.methods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      className={cn(
                        "rounded-md border px-3.5 py-2 text-[13px] transition-colors",
                        method.id === selectedMethod.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                      onClick={() => {
                        setSelectedMethodId(method.id);
                        openedAuthLinkRef.current = null;
                        handledCompletedSessionRef.current = null;
                        setAuthSession(null);
                        setErrorMessage(null);
                        setFeedback(null);
                        setSecret("");
                        setSessionInputValue("");
                        setSessionSelections([]);
                        setModelCatalog(null);
                        setSelectedModelRef("");
                      }}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                {modelCatalog && modelCatalog.models.length > 0 ? (
                  <div className="max-w-md space-y-1.5">
                    <label htmlFor="connection-model-select" className="block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
                      Model
                    </label>
                    <select
                      id="connection-model-select"
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none transition-colors focus:border-primary"
                      value={selectedModelRef}
                      onChange={(event) => {
                        setSelectedModelRef(event.target.value);
                      }}
                    >
                      {modelCatalog.models.map((model) => (
                        <option key={model.modelRef} value={model.modelRef}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      OpenGoat will use this model for {formatProviderName(selectedProvider)}.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 max-w-2xl">
                {selectedMethod.input === "api_key" || selectedMethod.input === "token" ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
                        {selectedMethod.label}
                      </h2>
                      <p className="text-[13px] leading-6 text-muted-foreground">
                        {selectedMethod.hint ?? "Paste the credential you want OpenGoat to use."}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
                        {selectedMethod.input === "token" ? "Token" : "API key"}
                      </label>
                      <Input
                        type="password"
                        className="h-10 rounded-md text-[13px]"
                        value={secret}
                        placeholder={
                          selectedMethod.input === "token"
                            ? "Paste provider token"
                            : "Paste provider API key"
                        }
                        onChange={(event) => {
                          setSecret(event.target.value);
                        }}
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="h-9 rounded-md px-4 text-[13px]"
                      disabled={!client || !secret.trim() || isBusy}
                      onClick={() => {
                        void handleSecretConnect();
                      }}
                    >
                      {isBusy ? (
                        <>
                          <LoaderCircleIcon className="size-3.5 animate-spin" />
                          Connecting
                        </>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
                        {selectedMethod.label}
                      </h2>
                      <p className="text-[13px] leading-6 text-muted-foreground">
                        {selectedMethod.hint ??
                          "Continue the sign-in flow in the browser, then finish any remaining steps here."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 rounded-md px-4 text-[13px]"
                        disabled={!client || isBusy}
                        onClick={() => {
                          void handleStartAuthSession();
                        }}
                      >
                        {isBusy ? (
                          <>
                            <LoaderCircleIcon className="size-3.5 animate-spin" />
                            Starting
                          </>
                        ) : (
                          <>
                            Start sign-in
                            <ExternalLinkIcon className="size-3.5" />
                          </>
                        )}
                      </Button>
                    </div>

                    {authSession ? (
                      <AuthSessionPanel
                        inputValue={sessionInputValue}
                        isBusy={isBusy}
                        session={authSession}
                        selections={sessionSelections}
                        setInputValue={setSessionInputValue}
                        setSelections={setSessionSelections}
                        onRespond={(value) => {
                          void handleRespondToSession(value);
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-6">
                <p className="text-[12px] text-muted-foreground">
                  Continue after connecting a provider.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-md px-4 text-[13px]"
                  disabled={!canContinue}
                  onClick={() => {
                    if (onClose) {
                      onContinue();
                    } else {
                      setStep("website");
                    }
                  }}
                >
                  Continue
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              </div>
            </section>
          ) : step === "website" ? (
            <WebsiteUrlStep
              url={websiteUrl}
              error={websiteUrlError}
              isSubmitting={isSubmittingProject}
              onUrlChange={(value) => {
                setWebsiteUrl(value);
                if (websiteUrlError) {
                  setWebsiteUrlError(null);
                }
              }}
              onSubmit={() => {
                const result = validateWebsiteUrl(websiteUrl);
                if (!result.valid) {
                  setWebsiteUrlError(result.error);
                  return;
                }
                setWebsiteUrlError(null);
                setIsSubmittingProject(true);
                void Promise.resolve(onContinue(result.normalized)).catch((error) => {
                  console.error("Failed to set up project", error);
                  setWebsiteUrlError("Failed to set up your project. Please try again.");
                  setIsSubmittingProject(false);
                });
              }}
              onBack={() => {
                setStep("configure");
              }}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Banner({
  children,
  tone,
}: {
  children: string;
  tone: "error" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-[13px]",
        tone === "error"
          ? "border-warning/20 bg-warning/8 text-warning-foreground"
          : "border-success/20 bg-success/8 text-success",
      )}
    >
      {children}
    </div>
  );
}

function AuthSessionPanel({
  inputValue,
  isBusy,
  onRespond,
  selections,
  session,
  setInputValue,
  setSelections,
}: {
  inputValue: string;
  isBusy: boolean;
  onRespond: (value?: boolean | string | string[]) => void;
  selections: string[];
  session: AuthSession;
  setInputValue: (nextValue: string) => void;
  setSelections: (nextSelections: string[]) => void;
}) {
  const step = session.step;

  if (step.type === "working") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        {step.message}
      </div>
    );
  }

  if (step.type === "completed") {
    return (
      <div className="rounded-lg border border-success/20 bg-success/8 px-3.5 py-2.5 text-[13px] text-success">
        {step.message ?? "Connection completed."}
      </div>
    );
  }

  if (step.type === "error") {
    return (
      <div className="rounded-lg border border-warning/20 bg-warning/8 px-3.5 py-2.5 text-[13px] text-warning-foreground">
        {step.message}
      </div>
    );
  }

  if (step.type === "auth_link") {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-3.5 py-3.5 text-[13px]">
        <div className="font-medium text-foreground">{step.label ?? "Browser sign-in ready"}</div>
        {step.instructions ? (
          <p className="mt-1 leading-5 text-muted-foreground">{step.instructions}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-8 rounded-md text-[12px]"
          onClick={() => {
            void openExternalUrl(step.url);
          }}
        >
          Open sign-in page
          <ExternalLinkIcon className="size-3.5" />
        </Button>
      </div>
    );
  }

  if (step.type === "confirm_prompt") {
    return (
      <div className="rounded-lg border border-border/60 bg-card px-3.5 py-3.5">
        <p className="text-[13px] leading-5 text-foreground">{step.message}</p>
        <div className="mt-3 flex gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md text-[12px]"
            disabled={isBusy}
            onClick={() => {
              onRespond(true);
            }}
          >
            {step.confirmLabel ?? "Continue"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-md text-[12px]"
            disabled={isBusy}
            onClick={() => {
              onRespond(false);
            }}
          >
            {step.cancelLabel ?? "Not now"}
          </Button>
        </div>
      </div>
    );
  }

  if (step.type === "text_prompt") {
    const isOAuthCodeStep = (() => {
      const lower = step.message.toLowerCase();
      return lower.includes("authorization code") || lower.includes("redirect url");
    })();

    if (isOAuthCodeStep) {
      return (
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <LoaderCircleIcon className="size-3.5 animate-spin" />
          Completing sign-in&hellip;
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border/60 bg-card px-3.5 py-3.5">
        <label className="block text-[13px] font-medium text-foreground">{step.message}</label>
        <Input
          type={step.secret ? "password" : "text"}
          className="mt-2 h-9 rounded-md text-[13px]"
          value={inputValue}
          placeholder={step.placeholder}
          onChange={(event) => {
            setInputValue(event.target.value);
          }}
        />
        <Button
          type="button"
          size="sm"
          className="mt-3 h-8 rounded-md text-[12px]"
          disabled={isBusy || (!step.allowEmpty && !inputValue.trim())}
          onClick={() => {
            onRespond(inputValue);
          }}
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card px-3.5 py-3.5">
      <p className="text-[13px] font-medium text-foreground">{step.message}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {step.options.map((option) => {
          const isSelected = selections.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                "rounded-md border px-3 py-1.5 text-[12px] transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
              onClick={() => {
                if (step.allowMultiple) {
                  setSelections(
                    isSelected
                      ? selections.filter((value) => value !== option.value)
                      : [...selections, option.value],
                  );
                  return;
                }
                setSelections([option.value]);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-3 h-8 rounded-md text-[12px]"
        disabled={isBusy || selections.length === 0}
        onClick={() => {
          onRespond(step.allowMultiple ? selections : selections[0] ?? "");
        }}
      >
        Continue
      </Button>
    </div>
  );
}

function ProviderMark({ provider }: { provider: ProviderDefinition }) {
  const logo = providerLogos[provider.id];

  if (!logo) {
    return (
      <div className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-muted text-sm font-semibold text-foreground">
        {provider.name.charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="provider-mark flex size-10 items-center justify-center rounded-lg border border-border/60 bg-card [&_svg]:size-5"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: logo.svg.replace(
          "<svg ",
          `<svg fill="var(--provider-mark-color, ${logo.color})" style="--provider-mark-dark-color: ${logo.darkColor ?? logo.color}" `,
        ),
      }}
    />
  );
}

function resolveProviderConnectionId(provider: ProviderDefinition): string {
  return provider.methods[0]?.providerId ?? provider.id;
}

function formatProviderName(provider: ProviderDefinition): string {
  if (provider.id === "copilot") {
    return "GitHub Copilot";
  }
  return provider.name;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Re-export for backward compatibility within this module
import { validateWebsiteUrl } from "@/lib/validation/url";

function WebsiteUrlStep({
  url,
  error,
  isSubmitting,
  onUrlChange,
  onSubmit,
  onBack,
}: {
  url: string;
  error: string | null;
  isSubmitting?: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <CheckIcon className="size-3.5 text-success" />
          <span>Provider connected</span>
          <span className="text-border">&#183;</span>
          <span className="font-medium text-foreground">Set up your project</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            What product is this for?
          </h2>
          <p className="text-[13px] leading-6 text-muted-foreground">
            Enter your website URL. OpenGoat will explore it to understand your
            product and build a marketing strategy.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="onboarding-website-url" className="block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
            Website URL
          </label>
          <div className="relative">
            <GlobeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              id="onboarding-website-url"
              type="url"
              className="h-10 rounded-md pl-9 text-[13px]"
              value={url}
              placeholder="myproduct.com"
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                onUrlChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && url.trim() && !isSubmitting) {
                  onSubmit();
                }
              }}
              autoFocus
            />
          </div>
          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              A bare domain like &ldquo;myapp.com&rdquo; or a full URL both work.
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 rounded-md px-4 text-[13px]"
          onClick={onBack}
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-md px-4 text-[13px]"
          disabled={!url.trim() || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? (
            <>
              <LoaderCircleIcon className="size-3.5 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              Get started
              <ArrowRightIcon className="size-3.5" />
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
