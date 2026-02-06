import { NodeFileSystem } from "../../platform/node/node-file-system.js";
import { NodeOpenGoatPathsProvider, NodePathPort } from "../../platform/node/node-path.port.js";
import { OpenGoatService } from "../../core/opengoat/index.js";
import { agentCommand } from "./commands/agent.command.js";
import { agentCreateCommand } from "./commands/agent-create.command.js";
import { agentListCommand } from "./commands/agent-list.command.js";
import { agentProviderGetCommand } from "./commands/agent-provider-get.command.js";
import { agentProviderSetCommand } from "./commands/agent-provider-set.command.js";
import { agentRunCommand } from "./commands/agent-run.command.js";
import { initCommand } from "./commands/init.command.js";
import { providerListCommand } from "./commands/provider-list.command.js";
import { CommandRouter } from "./framework/router.js";

export async function runCli(argv: string[]): Promise<number> {
  const service = createLazyService(() => {
    return new OpenGoatService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      pathsProvider: new NodeOpenGoatPathsProvider()
    });
  });

  const router = new CommandRouter(
    [
      initCommand,
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
