import type { OpenGoatPaths } from "../domain/opengoat-paths.js";

export interface OpenGoatPathsProvider {
  getPaths(): OpenGoatPaths;
}
