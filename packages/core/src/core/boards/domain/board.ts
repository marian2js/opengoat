export interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

export interface TaskRecord {
  taskId: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  assignedTo: string;
  title: string;
  description: string;
  status: string;
  statusReason?: string;
  metadata?: Record<string, unknown>;
  blockers: string[];
  artifacts: TaskEntry[];
  worklog: TaskEntry[];
}

export interface CreateTaskOptions {
  title: string;
  description: string;
  assignedTo?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ListTasksOptions {
  assignee?: string;
  limit?: number;
}
