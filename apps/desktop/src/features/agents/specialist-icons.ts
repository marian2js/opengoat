import type { LucideIcon } from "lucide-react";
import {
  BrainIcon,
  GlobeIcon,
  LayoutIcon,
  MegaphoneIcon,
  PenToolIcon,
  SearchIcon,
  SendIcon,
  TargetIcon,
  BotIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  brain: BrainIcon,
  search: SearchIcon,
  target: TargetIcon,
  layout: LayoutIcon,
  globe: GlobeIcon,
  megaphone: MegaphoneIcon,
  "pen-tool": PenToolIcon,
  send: SendIcon,
};

export function resolveSpecialistIcon(iconKey: string): LucideIcon {
  return iconMap[iconKey] ?? BotIcon;
}
