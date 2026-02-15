import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_REPORTS_TO = "ceo";

export interface CreateAgentFormValue {
  name: string;
  role: string;
  reportsTo: string;
}

export interface CreateAgentDialogAgent {
  id: string;
  displayName: string;
  role?: string;
}

export interface CreateAgentManagerOption {
  id: string;
  label: string;
}

interface UseCreateAgentDialogOptions {
  agents: CreateAgentDialogAgent[];
  setMutating: (value: boolean) => void;
  createAgent: (payload: {
    name: string;
    reportsTo: string;
    role?: string;
  }) => Promise<{ message?: string }>;
  onCreated: () => Promise<void>;
}

interface UseCreateAgentDialogResult {
  form: CreateAgentFormValue;
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  managerOptions: CreateAgentManagerOption[];
  openDialog: () => void;
  openDialogForCeo: () => void;
  setOpen: (open: boolean) => void;
  setName: (value: string) => void;
  setRole: (value: string) => void;
  setReportsTo: (value: string) => void;
  submitFromDialog: () => Promise<void>;
}

const DEFAULT_FORM: CreateAgentFormValue = {
  name: "",
  role: "",
  reportsTo: DEFAULT_REPORTS_TO,
};

export function useCreateAgentDialog(
  options: UseCreateAgentDialogOptions,
): UseCreateAgentDialogResult {
  const { agents, setMutating, createAgent, onCreated } = options;
  const [form, setForm] = useState<CreateAgentFormValue>(DEFAULT_FORM);
  const [isOpen, setOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managerOptions = useMemo(() => {
    return agents.map((agent) => {
      const roleLabel = resolveAgentRoleLabel(agent.role);
      return {
        id: agent.id,
        label: roleLabel ? `${agent.displayName} (${roleLabel})` : agent.displayName,
      };
    });
  }, [agents]);

  useEffect(() => {
    const agentIds = agents.map((agent) => agent.id);
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

  const submitFromDialog = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Agent name is required.");
      return;
    }

    if (agents.length === 0) {
      setError("No available manager targets found.");
      return;
    }

    const allowedReportsTo = new Set(agents.map((agent) => agent.id));
    const reportsTo = allowedReportsTo.has(form.reportsTo)
      ? form.reportsTo
      : agents[0]?.id ?? "";
    if (!reportsTo) {
      setError("Reports To is required.");
      return;
    }

    const submittedName = form.name;
    const submittedNameTrimmed = submittedName.trim();
    const submittedRole = form.role.trim();

    setSubmitting(true);
    setMutating(true);
    setError(null);

    try {
      const response = await createAgent({
        name: form.name,
        reportsTo,
        ...(submittedRole ? { role: submittedRole } : {}),
      });

      toast.success(response.message ?? `Agent \"${submittedName}\" processed.`);
      setForm((current) => {
        if (current.name.trim() !== submittedNameTrimmed) {
          return current;
        }
        return { ...current, name: "", role: "" };
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
  }, [agents, createAgent, form, onCreated, setMutating]);

  const handleSetOpen = useCallback((open: boolean) => {
    setOpen(open);
    setError(null);
  }, []);

  return {
    form,
    isOpen,
    isSubmitting,
    error,
    managerOptions,
    openDialog,
    openDialogForCeo,
    setOpen: handleSetOpen,
    setName,
    setRole,
    setReportsTo,
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
