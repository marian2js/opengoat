import { parseArgs } from "node:util";

const DEFAULT_HOSTNAME = "127.0.0.1";
const DEFAULT_USERNAME = "opengoat";

export interface SidecarConfig {
  hostname: string;
  port: number;
  password: string;
  username: string;
}

export function loadSidecarConfig(
  argv: string[] = process.argv.slice(2),
): SidecarConfig {
  const { values } = parseArgs({
    args: argv,
    options: {
      hostname: { type: "string" },
      port: { type: "string" },
      password: { type: "string" },
      username: { type: "string" },
    },
    allowPositionals: false,
    strict: true,
  });

  const hostname =
    values.hostname ?? process.env.OPENGOAT_SERVER_HOSTNAME ?? DEFAULT_HOSTNAME;
  const username =
    values.username ?? process.env.OPENGOAT_SERVER_USERNAME ?? DEFAULT_USERNAME;
  const password = values.password ?? process.env.OPENGOAT_SERVER_PASSWORD;
  const portCandidate = values.port ?? process.env.OPENGOAT_SERVER_PORT;

  if (!password) {
    throw new Error(
      "Missing sidecar password. Provide --password or OPENGOAT_SERVER_PASSWORD.",
    );
  }

  const port = Number.parseInt(portCandidate ?? "", 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(
      "Missing or invalid sidecar port. Provide --port or OPENGOAT_SERVER_PORT.",
    );
  }

  return {
    hostname,
    password,
    port,
    username,
  };
}
