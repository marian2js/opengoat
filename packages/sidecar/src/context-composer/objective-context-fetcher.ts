import type { SidecarRuntime } from "../server/context.ts";
import type { ObjectiveContextInput } from "./objective-context-composer.ts";

export interface ObjectiveScope {
  type: "objective";
  objectiveId: string;
}

export interface RunScope {
  type: "run";
  objectiveId: string;
  runId: string;
}

export type FetchableScope = ObjectiveScope | RunScope;

export async function fetchObjectiveContext(
  runtime: SidecarRuntime,
  scope: FetchableScope,
  projectId: string,
): Promise<ObjectiveContextInput> {
  const paths = runtime.opengoatPaths;
  const { objectiveId } = scope;

  // Build all promises — fetch in parallel for performance
  const objectivePromise = runtime.objectiveService
    .get(paths, objectiveId)
    .catch(() => null);

  const objectiveMemoriesPromise = runtime.memoryService
    .listMemories(paths, { projectId, objectiveId, scope: "objective" })
    .catch(() => []);

  const projectMemoriesPromise = runtime.memoryService
    .listMemories(paths, { projectId, scope: "project" })
    .catch(() => []);

  const artifactsPromise = runtime.artifactService
    .listArtifacts(paths, { objectiveId })
    .then((page) => page.items)
    .catch(() => []);

  const runPromise =
    scope.type === "run"
      ? runtime.runService.getRun(paths, scope.runId).catch(() => null)
      : Promise.resolve(null);

  const [objective, objectiveMemories, projectMemories, artifacts, run] =
    await Promise.all([
      objectivePromise,
      objectiveMemoriesPromise,
      projectMemoriesPromise,
      artifactsPromise,
      runPromise,
    ]);

  return {
    objective,
    objectiveMemories,
    projectMemories,
    run,
    artifacts,
  };
}
