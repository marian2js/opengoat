import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { OnboardChatPage } from "@/pages/onboard/OnboardChatPage";
import { OnboardPage } from "@/pages/onboard/OnboardPage";
import type { ReactElement } from "react";

export function App(): ReactElement {
  const pathname = window.location.pathname;
  if (isOnboardChatRoute(pathname)) {
    return <OnboardChatPage />;
  }

  if (isOnboardRoute(pathname)) {
    return <OnboardPage />;
  }

  return <DashboardPage />;
}

function isOnboardRoute(pathname: string): boolean {
  return pathname === "/onboard" || pathname === "/onboard/";
}

function isOnboardChatRoute(pathname: string): boolean {
  return pathname === "/onboard/chat" || pathname === "/onboard/chat/";
}
