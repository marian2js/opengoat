import { cn } from "@/lib/utils";
import { useMemo } from "react";

export interface SidebarVersionInfo {
  packageName: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  status:
    | "latest"
    | "update-available"
    | "ahead"
    | "unpublished"
    | "unknown";
  latestSource: "npm" | "github-release" | "github-tag" | null;
  checkedSources: Array<"npm" | "github-release" | "github-tag">;
  checkedAt: string;
  error?: string;
}

interface SidebarVersionStatusProps {
  versionInfo: SidebarVersionInfo | null;
  isVersionLoading: boolean;
  isSidebarCollapsed: boolean;
}

interface VersionPresentation {
  label: string;
  toneClassName: string;
  detail: string | null;
}

export function SidebarVersionStatus({
  versionInfo,
  isVersionLoading,
  isSidebarCollapsed,
}: SidebarVersionStatusProps): JSX.Element {
  const presentation = useMemo<VersionPresentation>(() => {
    if (isVersionLoading && !versionInfo) {
      return {
        label: "Checking updates",
        toneClassName: "text-muted-foreground",
        detail: null,
      };
    }

    if (versionInfo?.status === "update-available") {
      return {
        label: versionInfo.latestVersion
          ? `Update ${versionInfo.latestVersion}`
          : "Update available",
        toneClassName: "text-amber-300",
        detail: resolveLatestSourceLabel(versionInfo.latestSource),
      };
    }

    if (versionInfo?.status === "ahead") {
      return {
        label: "Development build",
        toneClassName: "text-sky-300",
        detail: versionInfo.latestVersion
          ? `Latest release: ${versionInfo.latestVersion}${
              resolveLatestSourceLabel(versionInfo.latestSource)
                ? ` (${resolveLatestSourceLabel(versionInfo.latestSource)})`
                : ""
            }`
          : null,
      };
    }

    if (versionInfo?.status === "latest") {
      return {
        label: "Latest",
        toneClassName: "text-emerald-300",
        detail: resolveLatestSourceLabel(versionInfo.latestSource),
      };
    }

    if (versionInfo?.status === "unpublished") {
      return {
        label: "Release pending",
        toneClassName: "text-sky-300",
        detail: null,
      };
    }

    return {
      label: versionInfo?.installedVersion
        ? "Status unavailable"
        : "Version unavailable",
      toneClassName: "text-muted-foreground",
      detail: versionInfo?.error ?? null,
    };
  }, [isVersionLoading, versionInfo]);

  const installedVersionLabel = versionInfo?.installedVersion?.trim() || "—";
  const summaryTitle = `OpenGoat v${installedVersionLabel} · ${presentation.label}${
    presentation.detail ? ` · ${presentation.detail}` : ""
  }`;

  if (isSidebarCollapsed) {
    return (
      <div className="mb-2 flex justify-center">
        <div
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-accent/40 text-[10px] text-muted-foreground",
          )}
          title={summaryTitle}
          aria-label={summaryTitle}
        >
          v
        </div>
      </div>
    );
  }

  return (
    <p className="mb-2 truncate px-1 text-[11px]" title={summaryTitle}>
      <span className="text-muted-foreground">OpenGoat </span>
      <span className="font-semibold text-foreground">v{installedVersionLabel}</span>
      <span className="text-muted-foreground"> · </span>
      <span className={presentation.toneClassName}>{presentation.label}</span>
    </p>
  );
}

function resolveLatestSourceLabel(
  source: SidebarVersionInfo["latestSource"],
): string | null {
  if (source === "npm") {
    return "npm";
  }
  if (source === "github-release") {
    return "GitHub release";
  }
  if (source === "github-tag") {
    return "GitHub tag";
  }
  return null;
}
