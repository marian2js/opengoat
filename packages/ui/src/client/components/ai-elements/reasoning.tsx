"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { Shimmer } from "./shimmer";

interface ReasoningContextValue {
  duration?: number;
  isOpen: boolean;
  isStreaming: boolean;
  setIsOpen: (open: boolean) => void;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoning = (): ReasoningContextValue => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within <Reasoning />.");
  }
  return context;
};

export interface ReasoningProps extends HTMLAttributes<HTMLDivElement> {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
  autoCloseOnFinish?: boolean;
}

const AUTO_CLOSE_DELAY_MS = 1000;
const MS_IN_SECOND = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    autoCloseOnFinish = true,
    children,
    ...props
  }: ReasoningProps) => {
    const resolvedDefaultOpen = defaultOpen ?? isStreaming;
    const isExplicitlyClosed = defaultOpen === false;

    const controlled = typeof open === "boolean";
    const [internalOpen, setInternalOpen] = useState(resolvedDefaultOpen);
    const isOpen = controlled ? Boolean(open) : internalOpen;

    const [duration, setDuration] = useState<number | undefined>(durationProp);
    const hasEverStreamedRef = useRef(isStreaming);
    const startTimeRef = useRef<number | null>(null);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);

    useEffect(() => {
      if (typeof durationProp === "number") {
        setDuration(durationProp);
      }
    }, [durationProp]);

    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true;
        setHasAutoClosed(false);
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now();
        }
      } else if (startTimeRef.current !== null) {
        const seconds = Math.ceil(
          (Date.now() - startTimeRef.current) / MS_IN_SECOND,
        );
        setDuration(Math.max(1, seconds));
        startTimeRef.current = null;
      }
    }, [isStreaming]);

    const setIsOpen = useCallback(
      (nextOpen: boolean) => {
        if (!controlled) {
          setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
      },
      [controlled, onOpenChange],
    );

    useEffect(() => {
      if (isStreaming && !isOpen && !isExplicitlyClosed) {
        setIsOpen(true);
      }
    }, [isStreaming, isOpen, isExplicitlyClosed, setIsOpen]);

    useEffect(() => {
      if (!autoCloseOnFinish) {
        return;
      }
      if (
        hasEverStreamedRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosed
      ) {
        const timer = window.setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY_MS);

        return () => {
          window.clearTimeout(timer);
        };
      }
    }, [autoCloseOnFinish, hasAutoClosed, isOpen, isStreaming, setIsOpen]);

    const value = useMemo<ReasoningContextValue>(
      () => ({
        duration,
        isOpen,
        isStreaming,
        setIsOpen,
      }),
      [duration, isOpen, isStreaming, setIsOpen],
    );

    return (
      <ReasoningContext.Provider value={value}>
        <div className={cn("not-prose mb-4", className)} {...props}>
          {children}
        </div>
      </ReasoningContext.Provider>
    );
  },
);

export interface ReasoningTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
}

const defaultThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Thinking...</Shimmer>;
  }
  if (duration === undefined) {
    return <p>Thought for a few seconds</p>;
  }
  return <p>Thought for {duration} seconds</p>;
};

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultThinkingMessage,
    onClick,
    ...props
  }: ReasoningTriggerProps) => {
    const { duration, isOpen, isStreaming, setIsOpen } = useReasoning();

    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
          className,
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
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </>
        )}
      </button>
    );
  },
);

export type ReasoningContentProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: string;
};

const streamdownPlugins = { cjk, code, math, mermaid };

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => {
    const { isOpen } = useReasoning();
    if (!isOpen) {
      return null;
    }

    return (
      <div
        className={cn(
          "mt-4 text-sm text-muted-foreground outline-none",
          className,
        )}
        {...props}
      >
        <Streamdown plugins={streamdownPlugins}>{children}</Streamdown>
      </div>
    );
  },
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
