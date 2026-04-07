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
    <header className="sticky top-0 z-20 border-b border-border/20 bg-background/85 backdrop-blur-xl dark:border-white/[0.03] dark:bg-background/80">
      <div className="flex h-11 items-center gap-3 px-4 lg:px-5">
        <SidebarTrigger className="-ml-1 text-muted-foreground/30 transition-colors duration-100 hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="hidden data-[orientation=vertical]:h-3.5 sm:block"
        />

        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
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
    <div className="flex items-center rounded-md border border-border/30 bg-muted/20 p-0.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          className={cn(
            "flex size-6 items-center justify-center rounded-[3px] transition-all duration-100",
            theme === option.value
              ? "bg-card text-foreground shadow-sm dark:bg-white/[0.08]"
              : "text-muted-foreground/40 hover:text-muted-foreground",
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
