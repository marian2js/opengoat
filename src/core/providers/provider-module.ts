import type { Provider } from "./types.js";

export interface ProviderModule {
  id: string;
  create: () => Provider;
}
