import type { ProviderModule } from "../../provider-module.js";
import { OpenClawProvider } from "./provider.js";

export const providerModule: ProviderModule = {
  id: "openclaw",
  create: () => new OpenClawProvider()
};

export { OpenClawProvider };
