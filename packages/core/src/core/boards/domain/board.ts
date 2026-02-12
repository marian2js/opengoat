export interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

export interface TaskRecord {
  taskId: string;
  boardId: string;
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

export interface BoardSummary {
  boardId: string;
  title: string;
  createdAt: string;
  owner: string;
}

export interface BoardRecord extends BoardSummary {
  tasks: TaskRecord[];
}

export interface CreateBoardOptions {
  title: string;
}

export interface UpdateBoardOptions {
  title?: string;
}

export interface CreateTaskOptions {
  title: string;
  description: string;
  project?: string;
  assignedTo?: string;
  status?: string;
}
