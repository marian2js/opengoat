import { openUrl } from "@tauri-apps/plugin-opener";

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
    return;
  } catch {
    if (typeof window.open === "function") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
  }

  throw new Error("Unable to open the external sign-in URL.");
}
