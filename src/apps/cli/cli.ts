import { NodeFileSystem } from "../../platform/node/node-file-system.js";
import { NodeOpenGoatPathsProvider, NodePathPort } from "../../platform/node/node-path.port.js";
import { OpenGoatService } from "../../core/services/opengoat.service.js";
import { agentCreateCommand } from "./commands/agent-create.command.js";
import { agentListCommand } from "./commands/agent-list.command.js";
import { agentProviderGetCommand } from "./commands/agent-provider-get.command.js";
import { agentProviderSetCommand } from "./commands/agent-provider-set.command.js";
import { agentRunCommand } from "./commands/agent-run.command.js";
import { initCommand } from "./commands/init.command.js";
import { providerListCommand } from "./commands/provider-list.command.js";
import { CommandRouter } from "./framework/router.js";

export async function runCli(argv: string[]): Promise<number> {
  const service = new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new NodeOpenGoatPathsProvider()
  });

  const router = new CommandRouter(
    [
      initCommand,
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
