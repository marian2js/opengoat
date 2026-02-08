"use client";

import type { Tool } from "ai";
import type { ComponentProps } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ai-elements/accordion";
import { Badge } from "@/components/ai-elements/badge";
import { cn } from "@/lib/utils";
import { BotIcon } from "lucide-react";
import { memo } from "react";

import { CodeBlock } from "./code-block";

export type AgentProps = ComponentProps<"div">;

export const Agent = memo(({ className, ...props }: AgentProps) => (
  <div
    className={cn("not-prose w-full rounded-2xl border border-border/70 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)]", className)}
    {...props}
  />
));

export type AgentHeaderProps = ComponentProps<"div"> & {
  name: string;
  model?: string;
};

export const AgentHeader = memo(
  ({ className, name, model, ...props }: AgentHeaderProps) => (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4 border-b border-border/65 p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <div className="grid size-6 place-items-center rounded-md border border-border/70 bg-[color-mix(in_oklab,var(--surface)_90%,transparent)]">
          <BotIcon className="size-3.5 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium">{name}</span>
        {model && (
          <Badge className="font-mono text-[11px]" variant="secondary">
            {model}
          </Badge>
        )}
      </div>
    </div>
  )
);

export type AgentContentProps = ComponentProps<"div">;

export const AgentContent = memo(
  ({ className, ...props }: AgentContentProps) => (
    <div className={cn("space-y-4 p-4", className)} {...props} />
  )
);

export type AgentInstructionsProps = ComponentProps<"div"> & {
  children: string;
};

export const AgentInstructions = memo(
  ({ className, children, ...props }: AgentInstructionsProps) => (
    <div className={cn("space-y-2", className)} {...props}>
      <span className="text-sm font-medium text-muted-foreground">
        Instructions
      </span>
      <div className="rounded-xl border border-border/65 bg-[color-mix(in_oklab,var(--surface-soft)_88%,transparent)] p-3 text-sm text-muted-foreground">
        <p>{children}</p>
      </div>
    </div>
  )
);

export type AgentToolsProps = ComponentProps<typeof Accordion>;

export const AgentTools = memo(({ className, ...props }: AgentToolsProps) => (
  <div className={cn("space-y-2", className)}>
    <span className="text-sm font-medium text-muted-foreground">Tools</span>
    <Accordion className="rounded-xl border border-border/70 bg-[color-mix(in_oklab,var(--surface-soft)_88%,transparent)]" {...props} />
  </div>
));

export type AgentToolProps = ComponentProps<typeof AccordionItem> & {
  tool: Tool;
};

export const AgentTool = memo(
  ({ className, tool, value, ...props }: AgentToolProps) => {
    const schema =
      "jsonSchema" in tool && tool.jsonSchema
        ? tool.jsonSchema
        : tool.inputSchema;

    return (
      <AccordionItem
        className={cn("border-b border-border/65 last:border-b-0", className)}
        value={value}
        {...props}
      >
        <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
          {tool.description ?? "No description"}
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <div className="rounded-lg border border-border/60 bg-[color-mix(in_oklab,var(--surface)_92%,transparent)]">
            <CodeBlock code={JSON.stringify(schema, null, 2)} language="json" />
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }
);

export type AgentOutputProps = ComponentProps<"div"> & {
  schema: string;
};

export const AgentOutput = memo(
  ({ className, schema, ...props }: AgentOutputProps) => (
    <div className={cn("space-y-2", className)} {...props}>
      <span className="text-sm font-medium text-muted-foreground">
        Output Schema
      </span>
      <div className="rounded-xl border border-border/65 bg-[color-mix(in_oklab,var(--surface-soft)_88%,transparent)]">
        <CodeBlock code={schema} language="typescript" />
      </div>
    </div>
  )
);

Agent.displayName = "Agent";
AgentHeader.displayName = "AgentHeader";
AgentContent.displayName = "AgentContent";
AgentInstructions.displayName = "AgentInstructions";
AgentTools.displayName = "AgentTools";
AgentTool.displayName = "AgentTool";
AgentOutput.displayName = "AgentOutput";
