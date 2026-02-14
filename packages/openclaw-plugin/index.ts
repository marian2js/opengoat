import { createOpenGoatCliRegistrar } from "./src/cli-registrar.js";
import { parseOpenGoatPluginConfig } from "./src/config.js";
import type { OpenClawPluginApiLike } from "./src/openclaw-types.js";
import { runOpenGoatProcess } from "./src/process-runner.js";
import { registerOpenGoatTools } from "./src/tools/register-tools.js";

const openGoatPlugin = {
  id: "openclaw-plugin",
  name: "OpenGoat",
  description: "Expose OpenGoat CLI as an OpenClaw plugin command.",
  register(api: OpenClawPluginApiLike): void {
    const pluginConfig = parseOpenGoatPluginConfig(api.pluginConfig);
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
  },
};

export default openGoatPlugin;
