import { ProviderNotFoundError } from "./errors.js";
import type { Provider } from "./types.js";

export type ProviderFactory = () => Provider;

export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();

  public register(providerId: string, factory: ProviderFactory): void {
    const id = providerId.trim().toLowerCase();
    if (!id) {
      throw new Error("Provider id cannot be empty.");
    }

    this.factories.set(id, factory);
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
}
