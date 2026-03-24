import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  BotIcon,
  BrainIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  Link2Icon,
  ListChecksIcon,
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
    title: "Dashboard",
    href: "#dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Board",
    href: "#board",
    icon: ListChecksIcon,
  },
  {
    title: "Chat",
    href: "#chat",
    icon: MessageSquareIcon,
  },
];

export const brainNavigation: NavigationItem[] = [
  { title: "Product", href: "#brain/product", icon: PackageIcon },
  { title: "Market", href: "#brain/market", icon: StoreIcon },
  { title: "Growth", href: "#brain/growth", icon: TrendingUpIcon },
  { title: "Company Context", href: "#brain/memory", icon: BrainIcon },
  { title: "Saved Guidance", href: "#brain/operating-memory", icon: DatabaseIcon },
  { title: "Knowledge Base", href: "#brain/knowledge", icon: BookOpenIcon },
];

export const secondaryNavigation: NavigationItem[] = [
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
  {
    title: "Settings",
    href: "#settings",
    icon: Settings2Icon,
  },
];
