export function taskStatusPillClasses(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "done":
      return "bg-success/20 text-success";
    case "doing":
      return "bg-sky-500/20 text-sky-300";
    case "blocked":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-accent text-foreground";
  }
}

export function taskStatusLabel(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "todo":
      return "To do";
    case "doing":
      return "In progress";
    case "pending":
      return "Pending";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default:
      return status;
  }
}
