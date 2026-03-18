import { homedir } from "node:os";
import { join } from "node:path";

export function resolveOpengoatConfigDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicitHome = env.OPENGOAT_HOME?.trim();
  if (explicitHome) {
    return explicitHome;
  }

  const appDirectoryName =
    process.platform === "linux" ? ".opengoat" : "OpenGoat";
  const configRoot = env.OPENGOAT_CONFIG_HOME?.trim() ?? resolvePlatformConfigRoot(env, homedir());

  return join(configRoot, appDirectoryName);
}

function resolvePlatformConfigRoot(
  env: NodeJS.ProcessEnv,
  homeDirectory: string,
): string {
  if (process.platform === "darwin") {
    return join(homeDirectory, "Library", "Application Support");
  }

  if (process.platform === "win32") {
    const appData = env.APPDATA?.trim();
    if (appData) {
      return appData;
    }

    return join(homeDirectory, "AppData", "Roaming");
  }

  const xdgConfigHome = env.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return xdgConfigHome;
  }

  return join(homeDirectory, ".config");
}
