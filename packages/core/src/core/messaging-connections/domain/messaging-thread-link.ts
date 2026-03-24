export interface MessagingThreadLinkRecord {
  threadLinkId: string;
  connectionId: string;
  externalThreadId: string;
  projectId: string;
  chatThreadId: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreadLinkOptions {
  connectionId: string;
  externalThreadId: string;
  projectId: string;
  chatThreadId: string;
}
