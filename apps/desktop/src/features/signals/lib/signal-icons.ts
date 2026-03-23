import {
  Globe,
  Target,
  Users,
  Search,
  Sparkles,
  Folder,
  type LucideIcon,
} from "lucide-react";
import type { SignalSourceType } from "@opengoat/contracts";

export const SOURCE_TYPE_ICONS: Record<SignalSourceType, LucideIcon> = {
  web: Globe,
  competitor: Target,
  community: Users,
  seo: Search,
  "ai-search": Sparkles,
  workspace: Folder,
};

export const SOURCE_TYPE_LABELS: Record<SignalSourceType, string> = {
  web: "Web",
  competitor: "Competitor",
  community: "Community",
  seo: "SEO",
  "ai-search": "AI Search",
  workspace: "Workspace",
};
