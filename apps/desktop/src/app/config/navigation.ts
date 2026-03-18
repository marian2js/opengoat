import type { LucideIcon } from "lucide-react";
import {
  BotIcon,
  Link2Icon,
  MessageSquareIcon,
  Settings2Icon,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export const primaryNavigation: NavigationItem[] = [
  {
    title: "Chat",
    href: "#chat",
    icon: MessageSquareIcon,
  },
  {
    title: "Agents",
    href: "#agents",
    icon: BotIcon,
  },
  {
    title: "Connections",
    href: "#connections",
    icon: Link2Icon,
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    title: "Settings",
    href: "#settings",
    icon: Settings2Icon,
  },
];
