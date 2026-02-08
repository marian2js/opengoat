/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkbenchOnboarding } from "@shared/workbench";
import { OnboardingPanel } from "./onboarding-panel";

afterEach(() => {
  cleanup();
});

describe("OnboardingPanel e2e", () => {
  it("filters providers from the search input", async () => {
    const user = userEvent.setup();

    render(
      createElement(OnboardingPanel, {
        onboarding: createOnboardingFixture(),
        providerId: "openai",
        env: {},
        gateway: createGatewayDraft(),
        error: null,
        canClose: true,
        isSubmitting: false,
        isRunningGuidedAuth: false,
        onboardingNotice: null,
        onSelectProvider: vi.fn(),
        onEnvChange: vi.fn(),
        onGatewayChange: vi.fn(),
        onRunGuidedAuth: vi.fn(),
        onClose: vi.fn(),
        onSubmit: vi.fn()
      })
    );

    expect(screen.getByRole("button", { name: /openai/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /openrouter/i })).toBeTruthy();

    await user.type(screen.getByPlaceholderText("Search providers"), "router");

    expect(screen.queryByRole("button", { name: /openai/i })).toBeNull();
    expect(screen.getByRole("button", { name: /openrouter/i })).toBeTruthy();
  });

  it("runs the full provider select and required-field submit flow", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    function StatefulHarness() {
      const [providerId, setProviderId] = useState("openai");
      const [env, setEnv] = useState<Record<string, string>>({});

      return createElement(OnboardingPanel, {
        onboarding: createOnboardingFixture(),
        providerId,
        env,
        gateway: createGatewayDraft(),
        error: null,
        canClose: true,
        isSubmitting: false,
        isRunningGuidedAuth: false,
        onboardingNotice: null,
        onSelectProvider: setProviderId,
        onEnvChange: (key: string, value: string) => {
          setEnv((current) => ({
            ...current,
            [key]: value
          }));
        },
        onGatewayChange: vi.fn(),
        onRunGuidedAuth: vi.fn(),
        onClose: vi.fn(),
        onSubmit
      });
    }

    render(createElement(StatefulHarness));

    const saveButton = screen.getByRole("button", { name: /save and start/i });
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: /openrouter/i }));
    expect(screen.getByPlaceholderText("OpenRouter API key")).toBeTruthy();

    await user.type(screen.getByPlaceholderText("OpenRouter API key"), "or-test-key");
    expect(saveButton.hasAttribute("disabled")).toBe(false);

    await user.click(saveButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("hides manual token input for guided OAuth providers", async () => {
    const user = userEvent.setup();
    const onRunGuidedAuth = vi.fn();

    render(
      createElement(OnboardingPanel, {
        onboarding: createOnboardingFixture(),
        providerId: "qwen-portal",
        env: {},
        gateway: createGatewayDraft(),
        error: null,
        canClose: true,
        isSubmitting: false,
        isRunningGuidedAuth: false,
        onboardingNotice: null,
        onSelectProvider: vi.fn(),
        onEnvChange: vi.fn(),
        onGatewayChange: vi.fn(),
        onRunGuidedAuth,
        onClose: vi.fn(),
        onSubmit: vi.fn()
      })
    );

    const oauthButton = screen.getByRole("button", { name: /sign in with oauth/i });
    expect(oauthButton).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Qwen OAuth token/i)).toBeNull();
    expect(screen.getByText(/Complete OAuth sign-in to continue/i)).toBeTruthy();

    await user.click(oauthButton);
    expect(onRunGuidedAuth).toHaveBeenCalledWith("qwen-portal");
  });

  it("requires URL when remote gateway mode is enabled", async () => {
    const user = userEvent.setup();

    function StatefulHarness() {
      const [gateway, setGateway] = useState(createGatewayDraft());
      return createElement(OnboardingPanel, {
        onboarding: createOnboardingFixture(),
        providerId: "openrouter",
        env: {
          OPENROUTER_API_KEY: "or-test-key"
        },
        gateway,
        error: null,
        canClose: true,
        isSubmitting: false,
        isRunningGuidedAuth: false,
        onboardingNotice: null,
        onSelectProvider: vi.fn(),
        onEnvChange: vi.fn(),
        onGatewayChange: (patch) =>
          setGateway((current) => ({
            ...current,
            ...patch
          })),
        onRunGuidedAuth: vi.fn(),
        onClose: vi.fn(),
        onSubmit: vi.fn()
      });
    }

    render(createElement(StatefulHarness));

    const saveButton = screen.getByRole("button", { name: /save and start/i });
    expect(saveButton.hasAttribute("disabled")).toBe(false);

    await user.click(screen.getByRole("button", { name: /show advanced options/i }));
    await user.click(screen.getByLabelText(/use remote opengoat server/i));
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    await user.type(
      screen.getByPlaceholderText("ws://remote-host:18789/gateway"),
      "ws://remote-host:18789/gateway"
    );
    expect(saveButton.hasAttribute("disabled")).toBe(false);
  });

  it("uses independent scroll areas for provider list and setup pane", () => {
    render(
      createElement(OnboardingPanel, {
        onboarding: createLargeOnboardingFixture(36),
        providerId: "provider-1",
        env: {},
        gateway: createGatewayDraft(),
        error: null,
        canClose: true,
        isSubmitting: false,
        isRunningGuidedAuth: false,
        onboardingNotice: null,
        onSelectProvider: vi.fn(),
        onEnvChange: vi.fn(),
        onGatewayChange: vi.fn(),
        onRunGuidedAuth: vi.fn(),
        onClose: vi.fn(),
        onSubmit: vi.fn()
      })
    );

    const scrollAreas = document.querySelectorAll('[data-slot="scroll-area"]');
    expect(scrollAreas.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /save and start/i })).toBeTruthy();
  });
});

function createOnboardingFixture(): WorkbenchOnboarding {
  return {
    activeProviderId: "openai",
    needsOnboarding: true,
    gateway: {
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false
    },
    families: [
      {
        id: "openai",
        label: "OpenAI",
        providerIds: ["openai"]
      },
      {
        id: "openrouter",
        label: "OpenRouter",
        providerIds: ["openrouter"]
      },
      {
        id: "qwen",
        label: "Qwen",
        providerIds: ["qwen-portal"]
      }
    ],
    providers: [
      {
        id: "openai",
        displayName: "OpenAI",
        kind: "http",
        envFields: [
          {
            key: "OPENAI_API_KEY",
            description: "OpenAI API key",
            required: true,
            secret: true
          }
        ],
        configuredEnvKeys: [],
        configuredEnvValues: {},
        missingRequiredEnv: ["OPENAI_API_KEY"],
        hasConfig: false
      },
      {
        id: "openrouter",
        displayName: "OpenRouter",
        kind: "http",
        envFields: [
          {
            key: "OPENROUTER_API_KEY",
            description: "OpenRouter API key",
            required: true,
            secret: true
          }
        ],
        configuredEnvKeys: [],
        configuredEnvValues: {},
        missingRequiredEnv: ["OPENROUTER_API_KEY"],
        hasConfig: false
      },
      {
        id: "qwen-portal",
        displayName: "Qwen Portal OAuth",
        kind: "http",
        guidedAuth: {
          title: "Qwen OAuth",
          description: "Open browser and approve access (recommended)."
        },
        envFields: [
          {
            key: "QWEN_OAUTH_TOKEN",
            description: "Qwen OAuth token (use guided sign-in).",
            required: true,
            secret: true
          }
        ],
        configuredEnvKeys: [],
        configuredEnvValues: {},
        missingRequiredEnv: ["QWEN_OAUTH_TOKEN"],
        hasConfig: false
      }
    ]
  };
}

function createLargeOnboardingFixture(totalProviders: number): WorkbenchOnboarding {
  const providerIds = Array.from({ length: totalProviders }, (_entry, index) => `provider-${index + 1}`);
  return {
    activeProviderId: providerIds[0] ?? "provider-1",
    needsOnboarding: true,
    gateway: {
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false
    },
    families: [
      {
        id: "stress",
        label: "Stress Test",
        providerIds
      }
    ],
    providers: providerIds.map((id, index) => ({
      id,
      displayName: `Provider ${index + 1}`,
      kind: "http" as const,
      envFields: [
        {
          key: `${id.toUpperCase().replace(/-/g, "_")}_API_KEY`,
          description: `API key for ${id}`,
          required: true,
          secret: true
        }
      ],
      configuredEnvKeys: [],
      configuredEnvValues: {},
      missingRequiredEnv: [`${id.toUpperCase().replace(/-/g, "_")}_API_KEY`],
      hasConfig: false
    }))
  };
}

function createGatewayDraft() {
  return {
    mode: "local" as "local" | "remote",
    remoteUrl: "",
    remoteToken: "",
    timeoutMs: 10_000
  };
}
