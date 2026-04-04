import type { ArtifactRecord, ArtifactService, ArtifactType, CreateArtifactOptions } from "@opengoat/core";
import type { OpenGoatPaths } from "@opengoat/core";
import { detectSections, matchHeadingToOutputType } from "./content-detector.ts";
import { mapOutputTypeToArtifactType } from "./output-type-mapper.ts";
import { cleanSectionTitle } from "./title-cleaner.ts";

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
  bundleId?: string;
}

interface ExtractionDeps {
  artifactService: Pick<ArtifactService, "createArtifact" | "createBundle">;
  opengoatPaths: OpenGoatPaths;
  specialist: { id: string; name: string; outputTypes: string[] };
}

interface MatchedSection {
  heading: string;
  content: string;
  artifactType: ArtifactType;
}

/**
 * Derives a bundle title from the specialist name and matched sections.
 * Format: "SpecialistName: Topic"
 */
function deriveBundleTitle(specialistName: string, sections: MatchedSection[]): string {
  if (sections.length === 0) return specialistName;

  const types = new Set(sections.map((s) => s.artifactType));
  if (types.size === 1) {
    const typeName = sections[0].artifactType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `${specialistName}: ${typeName} Bundle`;
  }

  return `${specialistName}: ${cleanSectionTitle(sections[0].heading, sections[0].content, sections[0].artifactType)}`;
}

/**
 * Extracts artifacts from specialist chat text.
 *
 * Flow: detectSections → matchHeadingToOutputType → mapOutputTypeToArtifactType
 *       → (if 2+) createBundle → createArtifact with bundleId
 */
export async function extractArtifacts(
  text: string,
  context: ExtractionContext,
  deps: ExtractionDeps,
): Promise<ExtractionResult> {
  const sections = detectSections(text);
  const matched: MatchedSection[] = [];
  let skipped = 0;

  // Pass 1: Collect matched sections without creating artifacts
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

    matched.push({
      heading: section.heading,
      content: section.content,
      artifactType,
    });
  }

  // Bundle decision: create bundle if 2+ matched sections
  let bundleId: string | undefined;
  if (matched.length >= 2) {
    const bundleTitle = deriveBundleTitle(deps.specialist.name, matched);
    const bundle = await deps.artifactService.createBundle(
      deps.opengoatPaths,
      { projectId: context.agentId, title: bundleTitle },
    );
    bundleId = bundle.bundleId;
  }

  // Pass 2: Create artifacts with optional bundleId
  const artifacts: ArtifactRecord[] = [];
  for (const section of matched) {
    const title = cleanSectionTitle(section.heading, section.content, section.artifactType);
    const options: CreateArtifactOptions = {
      projectId: context.agentId,
      title,
      type: section.artifactType,
      format: "markdown",
      contentRef: `chat://${context.sessionId}/${context.messageIndex ?? 0}`,
      createdBy: context.specialistId,
      content: section.content,
      ...(bundleId ? { bundleId } : {}),
      ...(context.objectiveId ? { objectiveId: context.objectiveId } : {}),
      ...(context.runId ? { runId: context.runId } : {}),
    };

    const record = await deps.artifactService.createArtifact(
      deps.opengoatPaths,
      options,
    );
    artifacts.push(record);
  }

  return { artifacts, skipped, bundleId };
}
