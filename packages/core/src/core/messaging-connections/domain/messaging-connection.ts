export interface MessagingConnectionRecord {
  connectionId: string;
  workspaceId: string;
  type: "telegram" | "whatsapp";
  status: "pending" | "connected" | "disconnected" | "error";
  displayName: string;
  defaultProjectId: string;
  configRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionOptions {
  workspaceId: string;
  type: "telegram" | "whatsapp";
  displayName: string;
  defaultProjectId: string;
  configRef?: string;
}

export interface UpdateConnectionOptions {
  status?: "pending" | "connected" | "disconnected" | "error";
  displayName?: string;
  defaultProjectId?: string;
  configRef?: string | null;
}

export interface ListConnectionOptions {
  workspaceId: string;
}
