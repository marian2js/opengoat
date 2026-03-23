import type { PlaybookManifest } from "../domain/playbook.js";

export class PlaybookRegistryService {
  private readonly playbooks: ReadonlyArray<PlaybookManifest>;

  constructor(builtinPlaybooks: PlaybookManifest[]) {
    this.playbooks = Object.freeze([...builtinPlaybooks]);
  }

  listPlaybooks(): PlaybookManifest[] {
    return [...this.playbooks];
  }

  getPlaybook(playbookId: string): PlaybookManifest {
    const playbook = this.playbooks.find((p) => p.playbookId === playbookId);
    if (!playbook) {
      throw new Error(`Playbook "${playbookId}" does not exist.`);
    }
    return playbook;
  }

  getPlaybooksByGoalType(goalType: string): PlaybookManifest[] {
    return this.playbooks.filter((p) => p.goalTypes.includes(goalType));
  }
}
