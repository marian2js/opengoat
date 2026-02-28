import { formatUiLogQuotedPreview } from "../text.js";
import type { TaskCronDispatchResult } from "../types.js";

export function formatTaskCronDispatchLogMessage(
  dispatch: TaskCronDispatchResult,
): string {
  const messagePreview = formatUiLogQuotedPreview(dispatch.message ?? "");
  const taskSuffix = dispatch.taskId ? ` task=${dispatch.taskId}` : "";
  const previewSuffix = messagePreview ? ` message="${messagePreview}"` : "";
  const sessionSuffix = ` session=${dispatch.sessionRef}`;
  const target = `@${dispatch.targetAgentId}`;
  if (!dispatch.ok) {
    const errorPreview = formatUiLogQuotedPreview(dispatch.error ?? "", 160);
    const errorSuffix = errorPreview ? ` error="${errorPreview}"` : "";
    return `[task-cron] Failed to deliver ${dispatch.kind} message to ${target}.${taskSuffix}${sessionSuffix}${previewSuffix}${errorSuffix}`;
  }
  return `[task-cron] Agent ${target} received ${dispatch.kind} message.${taskSuffix}${sessionSuffix}${previewSuffix}`;
}
