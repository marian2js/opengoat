import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/theme-context";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  currentView: "dashboard" | "connections" | "chat" | "action-session" | "brain" | "agents" | "settings" | "board" | "objective";
  onAddConnection: () => void;
  onCreateAgent: () => void;
}

export function AppHeader({
  currentView,
}: AppHeaderProps) {
  const pageTitle =
    currentView === "dashboard"
      ? "Dashboard"
      : currentView === "board"
        ? "Board"
        : currentView === "connections"
          ? "Connections"
          : currentView === "brain"
            ? "Brain"
            : currentView === "agents"
              ? "Agents"
              : currentView === "settings"
                ? "Settings"
                : currentView === "action-session"
                  ? "Action Session"
                  : currentView === "objective"
                    ? "Objective"
                    : "Chat";

  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="flex h-10 items-center gap-3 px-4 lg:px-5">
        <SidebarTrigger className="-ml-1 text-muted-foreground/50 hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="hidden data-[orientation=vertical]:h-3.5 sm:block"
        />

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[13px] font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, icon: SunIcon, label: "Light" },
    { value: "dark" as const, icon: MoonIcon, label: "Dark" },
    { value: "system" as const, icon: MonitorIcon, label: "System" },
  ];

  return (
    <div className="flex items-center rounded-md border border-border/40 bg-muted/30 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          className={cn(
            "flex size-6 items-center justify-center rounded-[3px] transition-all duration-100",
            theme === option.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground/50 hover:text-muted-foreground",
          )}
          onClick={() => {
            setTheme(option.value);
          }}
        >
          <option.icon className="size-3" />
        </button>
      ))}
    </div>
  );
}
