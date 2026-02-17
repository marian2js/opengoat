import { ProviderNotFoundError } from "./errors.js";
import {
  DEFAULT_PROVIDER_RUNTIME_POLICY,
  type ProviderModule,
  type ProviderOnboardingSpec,
  type ProviderRuntimePolicy
} from "./provider-module.js";
import type { Provider } from "./types.js";

export type ProviderFactory = () => Provider;

export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();
  private readonly modules = new Map<string, ProviderModule>();

  public register(providerId: string, factory: ProviderFactory, module?: ProviderModule): void {
    const id = providerId.trim().toLowerCase();
    if (!id) {
      throw new Error("Provider id cannot be empty.");
    }

    this.factories.set(id, factory);
    if (module) {
      this.modules.set(id, module);
    }
  }

  public listProviderIds(): string[] {
    return [...this.factories.keys()].sort((left, right) => left.localeCompare(right));
  }

  public create(providerId: string): Provider {
    const id = providerId.trim().toLowerCase();
    const factory = this.factories.get(id);

    if (!factory) {
      throw new ProviderNotFoundError(id || "(empty)", this.listProviderIds());
    }

    return factory();
  }

  public listProviders(): Provider[] {
    return this.listProviderIds().map((providerId) => this.create(providerId));
  }

  public getProviderModule(providerId: string): ProviderModule | undefined {
    return this.modules.get(providerId.trim().toLowerCase());
  }

  public getProviderOnboarding(providerId: string): ProviderOnboardingSpec | undefined {
    return this.getProviderModule(providerId)?.onboarding;
  }

  public getProviderRuntimePolicy(providerId: string): ProviderRuntimePolicy {
    const runtime = this.getProviderModule(providerId)?.runtime;
    const normalizedDirectories = normalizeSkillDirectories(
      runtime?.skills.directories ?? DEFAULT_PROVIDER_RUNTIME_POLICY.skills.directories,
    );
    return {
      invocation: {
        cwd: runtime?.invocation.cwd ?? DEFAULT_PROVIDER_RUNTIME_POLICY.invocation.cwd,
      },
      skills: {
        directories:
          normalizedDirectories.length > 0
            ? normalizedDirectories
            : [...DEFAULT_PROVIDER_RUNTIME_POLICY.skills.directories],
      },
    };
  }
}

function normalizeSkillDirectories(input: string[]): string[] {
  const normalized: string[] = [];
  for (const rawDirectory of input) {
    const directory = normalizeSkillDirectory(rawDirectory);
    if (!directory || normalized.includes(directory)) {
      continue;
    }
    normalized.push(directory);
  }
  return normalized;
}

function normalizeSkillDirectory(rawDirectory: string): string | null {
  const trimmed = rawDirectory.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return null;
  }

  const parts = trimmed
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== ".");
  if (parts.length === 0 || parts.includes("..")) {
    return null;
  }

  return parts.join("/");
}
