import { NodeFileSystem } from "../../platform/node/node-file-system.js";
import { NodeCommandRunner } from "../../platform/node/node-command-runner.js";
import { NodeOpenGoatPathsProvider, NodePathPort } from "../../platform/node/node-path.port.js";
import { OpenGoatService } from "../../core/opengoat/index.js";
import { agentCommand } from "./commands/agent.command.js";
import { agentCreateCommand } from "./commands/agent-create.command.js";
import { agentListCommand } from "./commands/agent-list.command.js";
import { agentProviderGetCommand } from "./commands/agent-provider-get.command.js";
import { agentProviderSetCommand } from "./commands/agent-provider-set.command.js";
import { agentRunCommand } from "./commands/agent-run.command.js";
import { initCommand } from "./commands/init.command.js";
import { onboardCommand } from "./commands/onboard.command.js";
import { pluginCommand } from "./commands/plugin.command.js";
import { pluginDisableCommand } from "./commands/plugin-disable.command.js";
import { pluginDoctorCommand } from "./commands/plugin-doctor.command.js";
import { pluginEnableCommand } from "./commands/plugin-enable.command.js";
import { pluginInfoCommand } from "./commands/plugin-info.command.js";
import { pluginInstallCommand } from "./commands/plugin-install.command.js";
import { pluginListCommand } from "./commands/plugin-list.command.js";
import { providerListCommand } from "./commands/provider-list.command.js";
import { routeCommand } from "./commands/route.command.js";
import { scenarioCommand } from "./commands/scenario.command.js";
import { scenarioRunCommand } from "./commands/scenario-run.command.js";
import { skillCommand } from "./commands/skill.command.js";
import { skillInstallCommand } from "./commands/skill-install.command.js";
import { skillListCommand } from "./commands/skill-list.command.js";
import { sessionCommand } from "./commands/session.command.js";
import { sessionCompactCommand } from "./commands/session-compact.command.js";
import { sessionHistoryCommand } from "./commands/session-history.command.js";
import { sessionListCommand } from "./commands/session-list.command.js";
import { sessionResetCommand } from "./commands/session-reset.command.js";
import { CommandRouter } from "./framework/router.js";

export async function runCli(argv: string[]): Promise<number> {
  const service = createLazyService(() => {
    return new OpenGoatService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      pathsProvider: new NodeOpenGoatPathsProvider(),
      commandRunner: new NodeCommandRunner()
    });
  });

  const router = new CommandRouter(
    [
      initCommand,
      onboardCommand,
      routeCommand,
      scenarioCommand,
      scenarioRunCommand,
      pluginCommand,
      pluginListCommand,
      pluginInstallCommand,
      pluginInfoCommand,
      pluginEnableCommand,
      pluginDisableCommand,
      pluginDoctorCommand,
      skillCommand,
      skillListCommand,
      skillInstallCommand,
      sessionCommand,
      sessionListCommand,
      sessionHistoryCommand,
      sessionResetCommand,
      sessionCompactCommand,
      agentCommand,
      agentCreateCommand,
      agentListCommand,
      providerListCommand,
      agentProviderGetCommand,
      agentProviderSetCommand,
      agentRunCommand
    ],
    {
      service,
      stdout: process.stdout,
      stderr: process.stderr
    }
  );

  return router.dispatch(argv);
}

function createLazyService(factory: () => OpenGoatService): OpenGoatService {
  let instance: OpenGoatService | undefined;

  const ensureInstance = (): OpenGoatService => {
    if (!instance) {
      instance = factory();
    }
    return instance;
  };

  return new Proxy({} as OpenGoatService, {
    get(_target, property, receiver) {
      const value = Reflect.get(ensureInstance() as object, property, receiver);
      if (typeof value === "function") {
        return value.bind(ensureInstance());
      }
      return value;
    }
  });
}
