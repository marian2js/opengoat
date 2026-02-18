import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_REPORTS_TO = "ceo";
const OPENCLAW_PROVIDER_ID = "openclaw";

export interface CreateAgentFormValue {
  name: string;
  role: string;
  reportsTo: string;
  providerId: string;
}

export interface CreateAgentDialogAgent {
  id: string;
  displayName: string;
  role?: string;
  providerId: string;
  supportsReportees: boolean;
}

export interface CreateAgentProviderOption {
  id: string;
  displayName: string;
  supportsReportees: boolean;
}

export interface CreateAgentManagerOption {
  id: string;
  label: string;
}

interface UseCreateAgentDialogOptions {
  agents: CreateAgentDialogAgent[];
  providers: CreateAgentProviderOption[];
  setMutating: (value: boolean) => void;
  createAgent: (payload: {
    name: string;
    reportsTo: string;
    role?: string;
    providerId: string;
  }) => Promise<{ message?: string }>;
  onCreated: () => Promise<void>;
}

interface UseCreateAgentDialogResult {
  form: CreateAgentFormValue;
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  providerOptions: CreateAgentProviderOption[];
  managerOptions: CreateAgentManagerOption[];
  openDialog: () => void;
  openDialogForCeo: () => void;
  setOpen: (open: boolean) => void;
  setName: (value: string) => void;
  setRole: (value: string) => void;
  setReportsTo: (value: string) => void;
  setProviderId: (value: string) => void;
  submitFromDialog: () => Promise<void>;
}

const DEFAULT_FORM: CreateAgentFormValue = {
  name: "",
  role: "",
  reportsTo: DEFAULT_REPORTS_TO,
  providerId: "openclaw",
};

export function useCreateAgentDialog(
  options: UseCreateAgentDialogOptions,
): UseCreateAgentDialogResult {
  const { agents, providers, setMutating, createAgent, onCreated } = options;
  const [form, setForm] = useState<CreateAgentFormValue>(DEFAULT_FORM);
  const [isOpen, setOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerOptions = useMemo(() => {
    const deduped = new Map<string, CreateAgentProviderOption>();
    for (const provider of providers) {
      const providerId = provider.id.trim().toLowerCase();
      if (!providerId || deduped.has(providerId)) {
        continue;
      }
      deduped.set(providerId, {
        id: providerId,
        displayName: provider.displayName.trim() || providerId,
        supportsReportees: provider.supportsReportees === true,
      });
    }

    if (!deduped.has("openclaw")) {
      deduped.set("openclaw", {
        id: "openclaw",
        displayName: "OpenClaw",
        supportsReportees: true,
      });
    }

    return sortProviderOptions([...deduped.values()]);
  }, [providers]);

  useEffect(() => {
    setForm((current) => {
      const allowedProviderIds = new Set(
        providerOptions.map((provider) => provider.id),
      );
      if (allowedProviderIds.has(current.providerId)) {
        return current;
      }
      return {
        ...current,
        providerId: resolveDefaultProviderId(providerOptions),
      };
    });
  }, [providerOptions]);

  const managerOptions = useMemo(() => {
    return agents
      .filter((agent) => {
        return (
          agent.providerId === OPENCLAW_PROVIDER_ID &&
          agent.supportsReportees !== false
        );
      })
      .map((agent) => {
        const roleLabel = resolveAgentRoleLabel(agent.role);
        return {
          id: agent.id,
          label: roleLabel ? `${agent.displayName} (${roleLabel})` : agent.displayName,
        };
      });
  }, [agents]);

  useEffect(() => {
    const agentIds = agents
      .filter((agent) => {
        return (
          agent.providerId === OPENCLAW_PROVIDER_ID &&
          agent.supportsReportees !== false
        );
      })
      .map((agent) => agent.id);
    if (agentIds.length === 0) {
      return;
    }

    setForm((current) => {
      if (agentIds.includes(current.reportsTo)) {
        return current;
      }
      return {
        ...current,
        reportsTo: agentIds[0] ?? DEFAULT_REPORTS_TO,
      };
    });
  }, [agents]);

  const openDialog = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const openDialogForCeo = useCallback(() => {
    setForm((current) => ({
      ...current,
      reportsTo: DEFAULT_REPORTS_TO,
    }));
    openDialog();
  }, [openDialog]);

  const setName = useCallback((value: string) => {
    setForm((current) => ({
      ...current,
      name: value,
    }));
  }, []);

  const setRole = useCallback((value: string) => {
    setForm((current) => ({
      ...current,
      role: value,
    }));
  }, []);

  const setReportsTo = useCallback((value: string) => {
    setForm((current) => ({
      ...current,
      reportsTo: value,
    }));
  }, []);

  const setProviderId = useCallback((value: string) => {
    setForm((current) => ({
      ...current,
      providerId: value,
    }));
  }, []);

  const submitFromDialog = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Agent name is required.");
      return;
    }

    const assignableManagers = agents.filter(
      (agent) => {
        return (
          agent.providerId === OPENCLAW_PROVIDER_ID &&
          agent.supportsReportees !== false
        );
      },
    );
    if (assignableManagers.length === 0) {
      setError("No available manager targets found.");
      return;
    }

    const allowedReportsTo = new Set(assignableManagers.map((agent) => agent.id));
    const reportsTo = allowedReportsTo.has(form.reportsTo)
      ? form.reportsTo
      : assignableManagers[0]?.id ?? "";
    if (!reportsTo) {
      setError("Reports To is required.");
      return;
    }

    const submittedName = form.name;
    const submittedNameTrimmed = submittedName.trim();
    const submittedRole = form.role.trim();
    const availableProviderIds = new Set(
      providerOptions.map((provider) => provider.id),
    );
    const providerId = availableProviderIds.has(form.providerId)
      ? form.providerId
      : resolveDefaultProviderId(providerOptions);

    setSubmitting(true);
    setMutating(true);
    setError(null);

    try {
      const response = await createAgent({
        name: form.name,
        reportsTo,
        providerId,
        ...(submittedRole ? { role: submittedRole } : {}),
      });

      toast.success(response.message ?? `Agent \"${submittedName}\" processed.`);
      setForm((current) => {
        if (current.name.trim() !== submittedNameTrimmed) {
          return current;
        }
        return {
          ...current,
          name: "",
          role: "",
          providerId: resolveDefaultProviderId(providerOptions),
        };
      });
      setOpen(false);
      await onCreated();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to create agent.";
      setError(message);
    } finally {
      setSubmitting(false);
      setMutating(false);
    }
  }, [agents, createAgent, form, onCreated, providerOptions, setMutating]);

  const handleSetOpen = useCallback((open: boolean) => {
    setOpen(open);
    setError(null);
  }, []);

  return {
    form,
    isOpen,
    isSubmitting,
    error,
    providerOptions,
    managerOptions,
    openDialog,
    openDialogForCeo,
    setOpen: handleSetOpen,
    setName,
    setRole,
    setReportsTo,
    setProviderId,
    submitFromDialog,
  };
}

function resolveAgentRoleLabel(role: string | undefined): string | undefined {
  const explicitRole = role?.trim();
  if (!explicitRole) {
    return undefined;
  }

  const genericRole = explicitRole.toLowerCase();
  if (
    genericRole === "manager" ||
    genericRole === "individual contributor" ||
    genericRole === "team member"
  ) {
    return undefined;
  }

  return explicitRole;
}

function resolveDefaultProviderId(
  providers: CreateAgentProviderOption[],
): string {
  return (
    providers.find((provider) => provider.id === "openclaw")?.id ??
    providers[0]?.id ??
    "openclaw"
  );
}

function sortProviderOptions(
  providers: CreateAgentProviderOption[],
): CreateAgentProviderOption[] {
  const sorted = [...providers];
  sorted.sort((left, right) => {
    const leftIsOpenClaw = left.id === "openclaw";
    const rightIsOpenClaw = right.id === "openclaw";
    if (leftIsOpenClaw && !rightIsOpenClaw) {
      return -1;
    }
    if (!leftIsOpenClaw && rightIsOpenClaw) {
      return 1;
    }

    return left.displayName.localeCompare(right.displayName, undefined, {
      sensitivity: "base",
    });
  });
  return sorted;
}
