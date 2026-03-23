import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { SignalService } from "./signal.service.js";
import type { CreateSignalOptions, SignalRecord } from "../domain/signal.js";
import { SIGNAL_TYPES } from "../domain/signal.js";

interface WorkspaceSignalDetectorDeps {
  signalService: SignalService;
  nowIso: () => string;
}

interface DetectionServices {
  boardService?: {
    listLatestTasksPage(
      paths: OpenGoatPaths,
      options: { status?: string; limit?: number },
    ): Promise<{
      tasks: Array<{
        taskId: string;
        title: string;
        status: string;
        statusReason?: string;
        updatedAt: string;
      }>;
      total: number;
    }>;
  };
}

interface DetectionResult {
  created: number;
  skipped: number;
}

interface CandidateSignal {
  signalType: string;
  title: string;
  summary: string;
  evidence: string;
}

export class WorkspaceSignalDetector {
  private readonly signalService: SignalService;
  private readonly nowIso: () => string;

  public constructor(deps: WorkspaceSignalDetectorDeps) {
    this.signalService = deps.signalService;
    this.nowIso = deps.nowIso;
  }

  public async detectAndCreateSignals(
    paths: OpenGoatPaths,
    projectId: string,
    services: DetectionServices,
  ): Promise<DetectionResult> {
    const candidates: CandidateSignal[] = [];

    if (services.boardService) {
      const blocked = await this.detectBlockedTasks(paths, services.boardService);
      candidates.push(...blocked);

      const pending = await this.detectPendingTasks(paths, services.boardService);
      candidates.push(...pending);
    }

    let created = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const isDuplicate = await this.isDuplicate(
        paths,
        projectId,
        candidate.signalType,
        candidate.evidence,
      );

      if (isDuplicate) {
        skipped++;
        continue;
      }

      const options: CreateSignalOptions = {
        projectId,
        sourceType: "workspace",
        signalType: candidate.signalType,
        title: candidate.title,
        summary: candidate.summary,
        evidence: candidate.evidence,
        importance: "medium",
        freshness: "fresh",
      };

      await this.signalService.createSignal(paths, options);
      created++;
    }

    return { created, skipped };
  }

  private async detectBlockedTasks(
    paths: OpenGoatPaths,
    boardService: NonNullable<DetectionServices["boardService"]>,
  ): Promise<CandidateSignal[]> {
    const result = await boardService.listLatestTasksPage(paths, {
      status: "blocked",
      limit: 50,
    });

    return result.tasks.map((task) => ({
      signalType: SIGNAL_TYPES.REVIEW_NEEDED_WARNING,
      title: `Blocked: ${task.title}`,
      summary: task.statusReason || `Task "${task.title}" is blocked and needs attention.`,
      evidence: `blocked-task:${task.taskId}`,
    }));
  }

  private async detectPendingTasks(
    paths: OpenGoatPaths,
    boardService: NonNullable<DetectionServices["boardService"]>,
  ): Promise<CandidateSignal[]> {
    const result = await boardService.listLatestTasksPage(paths, {
      status: "pending",
      limit: 50,
    });

    return result.tasks.map((task) => ({
      signalType: SIGNAL_TYPES.REVIEW_NEEDED_WARNING,
      title: `Needs review: ${task.title}`,
      summary: task.statusReason || `Task "${task.title}" is pending review.`,
      evidence: `pending-task:${task.taskId}`,
    }));
  }

  private async isDuplicate(
    paths: OpenGoatPaths,
    projectId: string,
    signalType: string,
    evidence: string,
  ): Promise<boolean> {
    const existing = await this.signalService.listSignals(paths, {
      projectId,
      sourceType: "workspace",
      limit: 100,
    });

    return existing.items.some(
      (signal) =>
        signal.signalType === signalType &&
        signal.evidence === evidence &&
        signal.status !== "dismissed",
    );
  }
}
