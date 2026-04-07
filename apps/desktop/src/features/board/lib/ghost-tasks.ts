import type { TaskRecord } from "@opengoat/contracts";

export const GHOST_TASK_PREFIX = "__ghost__";

const GHOST_TASKS: TaskRecord[] = [
  {
    taskId: `${GHOST_TASK_PREFIX}1`,
    title: "Homepage hero rewrite — review & approve",
    description: "Review the updated homepage hero copy generated from the Website Conversion workflow.",
    status: "pending",
    owner: "Website Conversion",
    assignedTo: "",
    createdAt: "",
    updatedAt: "",
    statusReason: undefined,
    blockers: [],
    artifacts: [],
    worklog: [],
  },
  {
    taskId: `${GHOST_TASK_PREFIX}2`,
    title: "SEO proof pages — publish to blog",
    description: "Publish the generated SEO/AEO content pages after review.",
    status: "todo",
    owner: "SEO / AEO",
    assignedTo: "",
    createdAt: "",
    updatedAt: "",
    statusReason: undefined,
    blockers: [],
    artifacts: [],
    worklog: [],
  },
  {
    taskId: `${GHOST_TASK_PREFIX}3`,
    title: "Product Hunt launch checklist — complete before launch",
    description: "Review and complete the pre-launch distribution checklist.",
    status: "todo",
    owner: "Distribution",
    assignedTo: "",
    createdAt: "",
    updatedAt: "",
    statusReason: undefined,
    blockers: [],
    artifacts: [],
    worklog: [],
  },
];

/**
 * Returns ghost/example task rows for the board preview.
 * Shows up to 3 example rows when the board has fewer than 3 real tasks.
 */
export function getGhostTasks(realTaskCount: number): TaskRecord[] {
  const needed = Math.max(0, 3 - realTaskCount);
  return GHOST_TASKS.slice(0, needed);
}
