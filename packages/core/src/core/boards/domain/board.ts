export interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

export interface TaskRecord {
  taskId: string;
  createdAt: string;
  project: string;
  owner: string;
  assignedTo: string;
  title: string;
  description: string;
  status: string;
  statusReason?: string;
  blockers: string[];
  artifacts: TaskEntry[];
  worklog: TaskEntry[];
}

export interface CreateTaskOptions {
  title: string;
  description: string;
  project?: string;
  assignedTo?: string;
  status?: string;
}

export interface ListTasksOptions {
  assignee?: string;
  limit?: number;
}
