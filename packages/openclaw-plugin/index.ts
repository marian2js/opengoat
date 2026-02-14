import { createOpenGoatCliRegistrar } from "./src/cli-registrar.js";
import { parseOpenGoatPluginConfig } from "./src/config.js";
import type { OpenClawPluginApiLike } from "./src/openclaw-types.js";
import { ensureOpenGoatCommandOnPath } from "./src/path-env.js";
import { runOpenGoatProcess } from "./src/process-runner.js";
import { registerOpenGoatTools } from "./src/tools/register-tools.js";

const OPENGOAT_PLUGIN_REGISTRATION_STATE_KEY = Symbol.for(
  "opengoat.openclaw.plugin.registration-state",
);

type PluginRegistrationState = {
  status: "idle" | "in-progress" | "done";
  source?: string;
};

const openGoatPlugin = {
  id: "openclaw-plugin",
  name: "OpenGoat",
  description: "Expose OpenGoat CLI as an OpenClaw plugin command.",
  register(api: OpenClawPluginApiLike): void {
    const registrationState = getGlobalPluginRegistrationState();
    if (registrationState.status !== "idle") {
      api.logger.info(
        `[opengoat-plugin] skipping duplicate registration for ${api.source}; already registered from ${
          registrationState.source ?? "another OpenGoat plugin instance"
        }.`,
      );
      return;
    }

    registrationState.status = "in-progress";
    registrationState.source = api.source;

    const pluginConfig = parseOpenGoatPluginConfig(api.pluginConfig);
    try {
      ensureOpenGoatCommandOnPath({
        command: "opengoat",
        pluginSource: api.source,
        cwd: pluginConfig.cwd,
        logger: api.logger,
      });
      const registeredTools = registerOpenGoatTools(api);
      api.logger.info(
        `[opengoat-plugin] registered ${registeredTools.length} OpenGoat tools.`,
      );

      api.registerCli(
        createOpenGoatCliRegistrar({
          logger: api.logger,
          config: pluginConfig,
          pluginSource: api.source,
          runOpenGoat: runOpenGoatProcess,
        }),
        { commands: ["opengoat"] },
      );
      registrationState.status = "done";
    } catch (error) {
      registrationState.status = "idle";
      throw error;
    }
  },
};

export default openGoatPlugin;

function getGlobalPluginRegistrationState(): PluginRegistrationState {
  const globalWithState = globalThis as typeof globalThis & {
    [OPENGOAT_PLUGIN_REGISTRATION_STATE_KEY]?: PluginRegistrationState;
  };

  if (!globalWithState[OPENGOAT_PLUGIN_REGISTRATION_STATE_KEY]) {
    globalWithState[OPENGOAT_PLUGIN_REGISTRATION_STATE_KEY] = {
      status: "idle",
    };
  }

  return globalWithState[OPENGOAT_PLUGIN_REGISTRATION_STATE_KEY];
}
