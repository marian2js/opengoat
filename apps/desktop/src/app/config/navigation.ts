import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
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
  UsersIcon,
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
    title: "Agents",
    href: "#agents",
    icon: UsersIcon,
  },
  {
    title: "Chat",
    href: "#chat",
    icon: MessageSquareIcon,
  },
];

export const demotedNavigation: NavigationItem[] = [
  {
    title: "Board",
    href: "#board",
    icon: ListChecksIcon,
  },
];

export const brainNavigation: NavigationItem[] = [
  { title: "Product", href: "#brain/product", icon: PackageIcon },
  { title: "Market", href: "#brain/market", icon: StoreIcon },
  { title: "Growth", href: "#brain/growth", icon: TrendingUpIcon },
  { title: "Company Context", href: "#brain/company-context", icon: BrainIcon },
  { title: "Saved Guidance", href: "#brain/saved-guidance", icon: DatabaseIcon },
  { title: "Agent Guidelines", href: "#brain/specialist-context", icon: UsersIcon },
  { title: "Knowledge Base", href: "#brain/knowledge-base", icon: BookOpenIcon },
];

export const secondaryNavigation: NavigationItem[] = [
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
