import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { OnboardChatPage } from "@/pages/onboard/OnboardChatPage";
import { OnboardConnectPage } from "@/pages/onboard/OnboardConnectPage";
import { OnboardPage } from "@/pages/onboard/OnboardPage";
import type { ReactElement } from "react";

export function App(): ReactElement {
  const pathname = window.location.pathname;
  if (isOnboardConnectRoute(pathname)) {
    return <OnboardConnectPage />;
  }

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

function isOnboardConnectRoute(pathname: string): boolean {
  return pathname === "/onboard/connect" || pathname === "/onboard/connect/";
}
