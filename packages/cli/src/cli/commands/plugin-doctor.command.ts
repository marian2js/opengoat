import type { CliCommand } from "../framework/command.js";

export const pluginDoctorCommand: CliCommand = {
  path: ["plugin", "doctor"],
  description: "Run OpenClaw plugin diagnostics.",
  async run(args, context): Promise<number> {
    const parsed = parseDoctorArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat plugin doctor [--json]\n");
      return 1;
    }

    const result = await context.service.pluginDoctor();
    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.code;
    }

    if (result.stdout.trim()) {
      context.stdout.write(`${result.stdout.trim()}\n`);
    }
    if (result.stderr.trim()) {
      context.stderr.write(`${result.stderr.trim()}\n`);
    }
    return result.code;
  }
};

type ParsedDoctorArgs =
  | {
      ok: true;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseDoctorArgs(args: string[]): ParsedDoctorArgs {
  let json = false;
  for (const token of args) {
    if (token === "--json") {
      json = true;
      continue;
    }
    return { ok: false, error: `Unknown option: ${token}` };
  }
  return {
    ok: true,
    json
  };
}
