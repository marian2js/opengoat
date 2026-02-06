import { ProviderNotFoundError } from "./errors.js";
import type { ProviderModule, ProviderOnboardingSpec } from "./provider-module.js";
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
}
