export const OBJECTIVE_MEMORY_CATEGORIES = [
  "current_goal",
  "success_definition",
  "already_tried",
  "avoid",
  "current_best_hypothesis",
  "review_notes",
  "final_decisions",
  "open_questions",
] as const;

export const OBJECTIVE_CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  current_goal: "Current Goal",
  success_definition: "Success Definition",
  already_tried: "Already Tried",
  avoid: "Avoid",
  current_best_hypothesis: "Current Best Hypothesis",
  review_notes: "Review Notes",
  final_decisions: "Final Decisions",
  open_questions: "Open Questions",
};

export const OBJECTIVE_CATEGORY_EMPTY_PROMPTS: Record<string, string> = {
  current_goal: "Define what this objective is trying to achieve",
  success_definition: "Describe what success looks like for this objective",
  already_tried: "Record approaches you've already attempted",
  avoid: "Note strategies or channels to steer clear of",
  current_best_hypothesis: "Capture your current best guess at the right approach",
  review_notes: "Add feedback and review comments from stakeholders",
  final_decisions: "Document decisions that are locked in",
  open_questions: "Track unresolved questions that need answers",
};
