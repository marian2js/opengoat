import {
  Zap,
  Clock,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { SignalImportance, SignalFreshness } from "@opengoat/contracts";

export const IMPORTANCE_COLORS: Record<
  SignalImportance,
  { accent: string; badge: string; text: string }
> = {
  low: {
    accent: "bg-muted-foreground/30",
    badge: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
  medium: {
    accent: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  },
  high: {
    accent: "bg-orange-500",
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    text: "text-orange-600 dark:text-orange-400",
  },
  critical: {
    accent: "bg-red-500",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
    text: "text-red-600 dark:text-red-400",
  },
};

export const FRESHNESS_CONFIG: Record<
  SignalFreshness,
  { label: string; icon: LucideIcon }
> = {
  fresh: { label: "Just now", icon: Zap },
  recent: { label: "Recent", icon: Clock },
  aging: { label: "Aging", icon: Clock },
  stale: { label: "Stale", icon: AlertCircle },
};
