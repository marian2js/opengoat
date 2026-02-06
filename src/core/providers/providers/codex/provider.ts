import type { ProviderAuthOptions, ProviderInvokeOptions } from "../../types.js";
import { BaseCliProvider } from "../../cli-provider.js";

export class CodexProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "codex",
      displayName: "Codex CLI",
      kind: "cli",
      command: "codex",
      commandEnvVar: "OPENGOAT_CODEX_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: true,
        passthrough: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args = ["exec", "--skip-git-repo-check"];

    if (options.model) {
      args.push("--model", options.model);
    }

    args.push(...(options.passthroughArgs ?? []));
    args.push(options.message);

    return args;
  }

  protected override buildAuthInvocationArgs(options: ProviderAuthOptions): string[] {
    return ["login", ...(options.passthroughArgs ?? [])];
  }
}
