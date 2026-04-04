import type { ArtifactRecord, ArtifactService, CreateArtifactOptions } from "@opengoat/core";
import type { OpenGoatPaths } from "@opengoat/core";
import { detectSections, matchHeadingToOutputType } from "./content-detector.ts";
import { mapOutputTypeToArtifactType } from "./output-type-mapper.ts";

export interface ExtractionContext {
  specialistId: string;
  agentId: string;
  sessionId: string;
  messageIndex?: number;
  objectiveId?: string;
  runId?: string;
}

export interface ExtractionResult {
  artifacts: ArtifactRecord[];
  skipped: number;
}

interface ExtractionDeps {
  artifactService: Pick<ArtifactService, "createArtifact">;
  opengoatPaths: OpenGoatPaths;
  specialist: { id: string; outputTypes: string[] };
}

/**
 * Extracts artifacts from specialist chat text.
 *
 * Flow: detectSections → matchHeadingToOutputType → mapOutputTypeToArtifactType → createArtifact
 */
export async function extractArtifacts(
  text: string,
  context: ExtractionContext,
  deps: ExtractionDeps,
): Promise<ExtractionResult> {
  const sections = detectSections(text);
  const artifacts: ArtifactRecord[] = [];
  let skipped = 0;

  for (const section of sections) {
    const matchedOutputType = matchHeadingToOutputType(
      section.heading,
      deps.specialist.outputTypes,
    );

    if (!matchedOutputType) {
      skipped++;
      continue;
    }

    const artifactType = mapOutputTypeToArtifactType(matchedOutputType);
    if (!artifactType) {
      skipped++;
      continue;
    }

    const options: CreateArtifactOptions = {
      projectId: context.agentId,
      title: section.heading,
      type: artifactType,
      format: "markdown",
      contentRef: `chat://${context.sessionId}/${context.messageIndex ?? 0}`,
      createdBy: context.specialistId,
      content: section.content,
      ...(context.objectiveId ? { objectiveId: context.objectiveId } : {}),
      ...(context.runId ? { runId: context.runId } : {}),
    };

    const record = await deps.artifactService.createArtifact(
      deps.opengoatPaths,
      options,
    );
    artifacts.push(record);
  }

  return { artifacts, skipped };
}
