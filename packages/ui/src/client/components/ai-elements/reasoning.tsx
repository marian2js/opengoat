"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface ReasoningContextValue {
  duration?: number;
  isOpen: boolean;
  isStreaming: boolean;
  setIsOpen: (open: boolean) => void;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoningContext = (): ReasoningContextValue => {
  const value = useContext(ReasoningContext);
  if (!value) {
    throw new Error("Reasoning components must be used within <Reasoning />.");
  }
  return value;
};

export interface ReasoningProps extends HTMLAttributes<HTMLDivElement> {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Reasoning = ({
  className,
  isStreaming = false,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: ReasoningProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [duration, setDuration] = useState<number | undefined>(undefined);

  const controlled = typeof open === "boolean";
  const isOpen = controlled ? open : internalOpen;

  useEffect(() => {
    if (!controlled) {
      setInternalOpen(isStreaming);
    }
  }, [controlled, isStreaming]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const startedAt = Date.now();
    setDuration(0);
    const timer = window.setInterval(() => {
      setDuration(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isStreaming]);

  const setIsOpen = (nextOpen: boolean) => {
    if (!controlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const value = useMemo<ReasoningContextValue>(
    () => ({
      duration,
      isOpen,
      isStreaming,
      setIsOpen
    }),
    [duration, isOpen, isStreaming]
  );

  return (
    <ReasoningContext.Provider value={value}>
      <div className={cn("w-full space-y-2", className)} {...props}>
        {children}
      </div>
    </ReasoningContext.Provider>
  );
};

export interface ReasoningTriggerProps extends ComponentProps<"button"> {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
}

export const ReasoningTrigger = ({
  className,
  getThinkingMessage = defaultThinkingMessage,
  onClick,
  ...props
}: ReasoningTriggerProps) => {
  const { duration, isOpen, isStreaming, setIsOpen } = useReasoningContext();

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }
        setIsOpen(!isOpen);
      }}
      {...props}
    >
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          isStreaming ? "animate-pulse bg-success" : "bg-muted-foreground/70"
        )}
      />
      <span>{getThinkingMessage(isStreaming, duration)}</span>
      <ChevronDownIcon className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
    </button>
  );
};

export type ReasoningContentProps = HTMLAttributes<HTMLDivElement>;

export const ReasoningContent = ({ className, ...props }: ReasoningContentProps) => {
  const { isOpen } = useReasoningContext();
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "max-w-2xl rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground",
        className
      )}
      {...props}
    />
  );
};

function defaultThinkingMessage(isStreaming: boolean, duration?: number): string {
  if (isStreaming && typeof duration === "number" && duration > 0) {
    return `Thinking for ${duration}s`;
  }
  return isStreaming ? "Thinking..." : "Thought for a few seconds";
}
