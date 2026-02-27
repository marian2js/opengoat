import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { OnboardPage } from "@/pages/onboard/OnboardPage";
import type { ReactElement } from "react";

export function App(): ReactElement {
  if (isOnboardRoute(window.location.pathname)) {
    return <OnboardPage />;
  }

  return <DashboardPage />;
}

function isOnboardRoute(pathname: string): boolean {
  return pathname === "/onboard" || pathname === "/onboard/";
}
