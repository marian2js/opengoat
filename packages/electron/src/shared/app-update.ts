export type DesktopAppUpdateStatus =
  | "idle"
  | "disabled"
  | "checking"
  | "update-available"
  | "update-downloaded"
  | "error";

export interface DesktopAppUpdateState {
  status: DesktopAppUpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  checkedAt: string | null;
  reason: string | null;
  error: string | null;
}
