import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  BotIcon,
  BrainIcon,
  Link2Icon,
  MessageSquareIcon,
  PackageIcon,
  Settings2Icon,
  StoreIcon,
  TrendingUpIcon,
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

export const brainNavigation: NavigationItem[] = [
  { title: "Product", href: "#brain/product", icon: PackageIcon },
  { title: "Market", href: "#brain/market", icon: StoreIcon },
  { title: "Growth", href: "#brain/growth", icon: TrendingUpIcon },
  { title: "Memory", href: "#brain/memory", icon: BrainIcon },
  { title: "Knowledge", href: "#brain/knowledge", icon: BookOpenIcon },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    title: "Settings",
    href: "#settings",
    icon: Settings2Icon,
  },
];
