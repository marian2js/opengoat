import {
  CircleSlash,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { Signal, TaskRecord } from "@opengoat/contracts";
import { SOURCE_TYPE_ICONS } from "@/features/signals/lib/signal-icons";
import { IMPORTANCE_COLORS } from "@/features/signals/lib/signal-colors";

export type FeedItemType = "signal" | "blocked-task" | "pending-task";

export interface FeedItem {
  id: string;
  type: FeedItemType;
  icon: LucideIcon;
  title: string;
  summary: string;
  timestamp: string;
  accentColor: string;
  action: { label: string; href?: string } | null;
}

export function mapSignalToFeedItem(signal: Signal): FeedItem {
  const sourceIcon = SOURCE_TYPE_ICONS[signal.sourceType] ?? SOURCE_TYPE_ICONS.web;
  const importanceColors = IMPORTANCE_COLORS[signal.importance] ?? IMPORTANCE_COLORS.medium;

  return {
    id: `signal-${signal.signalId}`,
    type: "signal",
    icon: sourceIcon,
    title: signal.title,
    summary: signal.summary,
    timestamp: signal.createdAt,
    accentColor: importanceColors.accent,
    action: { label: "View signal" },
  };
}

export function mapBlockedTaskToFeedItem(task: TaskRecord): FeedItem {
  return {
    id: `blocked-${task.taskId}`,
    type: "blocked-task",
    icon: CircleSlash,
    title: `Blocked: ${task.title}`,
    summary: task.statusReason || `Task is blocked and needs attention.`,
    timestamp: task.updatedAt || task.createdAt,
    accentColor: "bg-red-500",
    action: { label: "View task" },
  };
}

export function mapPendingTaskToFeedItem(task: TaskRecord): FeedItem {
  return {
    id: `pending-${task.taskId}`,
    type: "pending-task",
    icon: Clock,
    title: `Needs review: ${task.title}`,
    summary: task.statusReason || `Task is pending review.`,
    timestamp: task.updatedAt || task.createdAt,
    accentColor: "bg-amber-500",
    action: { label: "Review task" },
  };
}

export function mergeFeedItems(items: FeedItem[]): FeedItem[] {
  return [...items]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);
}
