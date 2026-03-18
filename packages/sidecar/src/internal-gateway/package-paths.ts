import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export function resolveGatewayPackageRoot(): string {
  const exportedEntrypoint = require.resolve("openclaw");
  return dirname(dirname(exportedEntrypoint));
}

export function resolveGatewayCliEntrypoint(): string {
  return require.resolve("openclaw/cli-entry");
}

export function resolveGatewayInternalImport(specifier: string): string {
  return pathToFileURL(join(resolveGatewayPackageRoot(), specifier)).href;
}
