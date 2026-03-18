import type { PropsWithChildren } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
