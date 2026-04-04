import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { ArtifactService } from "../../artifacts/application/artifact.service.js";
import type { RunService } from "../../runs/application/run.service.js";
import type { RunRecord } from "../../runs/domain/run.js";
import type { PlaybookRegistryService } from "./playbook-registry.service.js";
import { matchArtifactsToExpected } from "./artifact-phase-matcher.js";

export interface StartPlaybookOptions {
  playbookId: string;
  projectId: string;
  objectiveId: string;
}

export interface PhaseProgressResult {
  advanced: boolean;
  completed: boolean;
  run: RunRecord;
}

export interface PhaseProgress {
  name: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  specialistId?: string;
  expectedArtifacts: string[];
  matchedArtifacts: string[];
  missingArtifacts: string[];
}

export interface PlaybookProgress {
  runId: string;
  playbookId: string;
  playbookTitle: string;
  currentPhase: string;
  runStatus: string;
  phases: PhaseProgress[];
}

interface PlaybookExecutionServiceDeps {
  runService: RunService;
  artifactService: ArtifactService;
  playbookRegistryService: PlaybookRegistryService;
}

export class PlaybookExecutionService {
  private readonly runService: RunService;
  private readonly artifactService: ArtifactService;
  private readonly playbookRegistryService: PlaybookRegistryService;

  constructor(deps: PlaybookExecutionServiceDeps) {
    this.runService = deps.runService;
    this.artifactService = deps.artifactService;
    this.playbookRegistryService = deps.playbookRegistryService;
  }

  /**
   * Start a playbook: creates a run, sets it to running, and initializes the first phase.
   */
  async startPlaybook(
    paths: OpenGoatPaths,
    options: StartPlaybookOptions,
  ): Promise<RunRecord> {
    const manifest = this.playbookRegistryService.getPlaybook(options.playbookId);
    const firstPhase = manifest.defaultPhases[0];

    if (!firstPhase) {
      throw new Error(`Playbook "${options.playbookId}" has no phases`);
    }

    const run = await this.runService.createRun(paths, {
      projectId: options.projectId,
      objectiveId: options.objectiveId,
      playbookId: options.playbookId,
      title: manifest.title,
      startedFrom: "action",
      phase: firstPhase.name,
      phaseSummary: firstPhase.description,
    });

    // Transition from draft → running
    return this.runService.updateRunStatus(paths, run.runId, "running");
  }

  /**
   * Check if the current phase's expected artifacts have been produced.
   * If so, advance to the next phase or complete the run.
   */
  async checkPhaseProgress(
    paths: OpenGoatPaths,
    runId: string,
  ): Promise<PhaseProgressResult> {
    const run = await this.runService.getRun(paths, runId);

    if (!run.playbookId) {
      throw new Error("Run is not associated with a playbook");
    }

    const manifest = this.playbookRegistryService.getPlaybook(run.playbookId);
    const currentPhaseIndex = manifest.defaultPhases.findIndex(
      (p) => p.name === run.phase,
    );

    if (currentPhaseIndex === -1) {
      return { advanced: false, completed: false, run };
    }

    const currentPhase = manifest.defaultPhases[currentPhaseIndex]!;
    const expectedArtifacts = currentPhase.expectedArtifacts ?? [];

    // If no expected artifacts, phase is automatically satisfied
    if (expectedArtifacts.length === 0) {
      return this.advanceOrComplete(paths, run, manifest, currentPhaseIndex);
    }

    // Get artifacts for this run
    const artifactPage = await this.artifactService.listArtifacts(paths, {
      runId: run.runId,
    });

    const { missing } = matchArtifactsToExpected(
      artifactPage.items,
      expectedArtifacts,
    );

    if (missing.length > 0) {
      return { advanced: false, completed: false, run };
    }

    return this.advanceOrComplete(paths, run, manifest, currentPhaseIndex);
  }

  /**
   * Get detailed progress for a playbook run.
   */
  async getRunProgress(
    paths: OpenGoatPaths,
    runId: string,
  ): Promise<PlaybookProgress> {
    const run = await this.runService.getRun(paths, runId);

    if (!run.playbookId) {
      throw new Error("Run is not associated with a playbook");
    }

    const manifest = this.playbookRegistryService.getPlaybook(run.playbookId);
    const currentPhaseIndex = manifest.defaultPhases.findIndex(
      (p) => p.name === run.phase,
    );

    // Get all artifacts for the run
    const artifactPage = await this.artifactService.listArtifacts(paths, {
      runId: run.runId,
    });

    const isCompleted = run.status === "completed";

    const phases: PhaseProgress[] = manifest.defaultPhases.map((phase, index) => {
      const expectedArtifacts = phase.expectedArtifacts ?? [];
      const { matched, missing } = matchArtifactsToExpected(
        artifactPage.items,
        expectedArtifacts,
      );

      let status: PhaseProgress["status"];
      if (isCompleted || index < currentPhaseIndex) {
        status = "completed";
      } else if (index === currentPhaseIndex) {
        status = isCompleted ? "completed" : "current";
      } else {
        status = "upcoming";
      }

      return {
        name: phase.name,
        description: phase.description,
        status,
        specialistId: phase.specialistId,
        expectedArtifacts,
        matchedArtifacts: Array.from(matched.keys()),
        missingArtifacts: missing,
      };
    });

    return {
      runId: run.runId,
      playbookId: run.playbookId,
      playbookTitle: manifest.title,
      currentPhase: run.phase,
      runStatus: run.status,
      phases,
    };
  }

  private async advanceOrComplete(
    paths: OpenGoatPaths,
    run: RunRecord,
    manifest: { defaultPhases: Array<{ name: string; description: string }> },
    currentPhaseIndex: number,
  ): Promise<PhaseProgressResult> {
    const isLastPhase = currentPhaseIndex === manifest.defaultPhases.length - 1;

    if (isLastPhase) {
      const completedRun = await this.runService.completeRun(paths, run.runId);
      return { advanced: false, completed: true, run: completedRun };
    }

    const nextPhase = manifest.defaultPhases[currentPhaseIndex + 1]!;
    const advancedRun = await this.runService.advancePhase(paths, run.runId, {
      phase: nextPhase.name,
      phaseSummary: nextPhase.description,
    });

    return { advanced: true, completed: false, run: advancedRun };
  }
}
