import { useCallback, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface UseSignalActionsResult {
  saveSignal: (signalId: string) => Promise<void>;
  dismissSignal: (signalId: string) => Promise<void>;
  promoteSignal: (signalId: string) => Promise<void>;
  actionLoading: Record<string, boolean>;
}

export function useSignalActions(
  client: SidecarClient,
  onSuccess?: () => void,
): UseSignalActionsResult {
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );

  const setLoading = (signalId: string, loading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [signalId]: loading }));
  };

  const saveSignal = useCallback(
    async (signalId: string) => {
      setLoading(signalId, true);
      try {
        await client.updateSignalStatus(signalId, "saved");
        onSuccess?.();
      } catch (err) {
        console.error("Failed to save signal:", err);
      } finally {
        setLoading(signalId, false);
      }
    },
    [client, onSuccess],
  );

  const dismissSignal = useCallback(
    async (signalId: string) => {
      setLoading(signalId, true);
      try {
        await client.dismissSignal(signalId);
        onSuccess?.();
      } catch (err) {
        console.error("Failed to dismiss signal:", err);
      } finally {
        setLoading(signalId, false);
      }
    },
    [client, onSuccess],
  );

  const promoteSignal = useCallback(
    async (signalId: string) => {
      setLoading(signalId, true);
      try {
        await client.promoteSignal(signalId);
        onSuccess?.();
      } catch (err) {
        console.error("Failed to promote signal:", err);
      } finally {
        setLoading(signalId, false);
      }
    },
    [client, onSuccess],
  );

  return { saveSignal, dismissSignal, promoteSignal, actionLoading };
}
