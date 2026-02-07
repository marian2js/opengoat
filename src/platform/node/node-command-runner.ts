import { spawn } from "node:child_process";
import type { CommandRunRequest, CommandRunResult, CommandRunnerPort } from "../../core/ports/command-runner.port.js";

export class NodeCommandRunner implements CommandRunnerPort {
  public run(request: CommandRunRequest): Promise<CommandRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(request.command, request.args, {
        cwd: request.cwd,
        env: request.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => {
        resolve({
          code: code ?? 1,
          stdout,
          stderr
        });
      });
    });
  }
}
