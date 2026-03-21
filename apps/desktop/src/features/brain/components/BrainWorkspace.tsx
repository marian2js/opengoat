import {
  BookOpenIcon,
  BrainIcon,
  CheckIcon,
  FileUpIcon,
  FlameIcon,
  LoaderCircleIcon,
  LightbulbIcon,
  PackageIcon,
  PencilIcon,
  SparklesIcon,
  StoreIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SidecarClient } from "@/lib/sidecar/client";
import { isRefinableSection } from "@/features/brain/lib/refine-context-prompt";

interface BrainSection {
  id: string;
  label: string;
  filename: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  placeholder: string;
}

const BRAIN_SECTIONS: BrainSection[] = [
  {
    id: "product",
    label: "Product",
    filename: "PRODUCT.md",
    icon: PackageIcon,
    description: "What this product does, who it's for, and how it works",
    placeholder: `# Product Overview

## What is this product?
Describe what the product does and the problem it solves.

## Target Users
Who are the primary users? What are their needs?

## Key Features
- Feature 1
- Feature 2
- Feature 3

## Tech Stack
What technologies power this product?`,
  },
  {
    id: "market",
    label: "Market",
    filename: "MARKET.md",
    icon: StoreIcon,
    description: "Market landscape, competitors, and positioning",
    placeholder: `# Market Analysis

## Market Size
What is the total addressable market?

## Competitors
Who are the main competitors and how do they compare?

## Positioning
What makes this product unique in the market?

## Trends
What market trends support this product's growth?`,
  },
  {
    id: "growth",
    label: "Growth",
    filename: "GROWTH.md",
    icon: TrendingUpIcon,
    description: "Growth strategy, metrics, and acquisition channels",
    placeholder: `# Growth Strategy

## Key Metrics
What are the north star metrics?

## Acquisition Channels
How do users discover this product?

## Retention
What drives users to come back?

## Growth Loops
What self-reinforcing loops drive growth?`,
  },
  {
    id: "memory",
    label: "Memory",
    filename: "MEMORY.md",
    icon: BrainIcon,
    description: "Persistent context and decisions the AI should remember",
    placeholder: `# Memory

## Key Decisions
Important decisions and the reasoning behind them.

## Preferences
Coding style, communication preferences, and conventions.

## Context
Background information that helps the AI assist more effectively.`,
  },
  {
    id: "knowledge",
    label: "Knowledge",
    filename: "KNOWLEDGE.md",
    icon: BookOpenIcon,
    description: "Domain knowledge, documentation, and imported references",
    placeholder: `# Knowledge Base

Add domain-specific knowledge, documentation excerpts, API references, or any other information that helps provide better context.

## References
-

## Notes
- `,
  },
];

export interface BrainWorkspaceProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
  onRefineContext?: (sectionId: string) => void;
  sectionId: string;
}

export function BrainWorkspace({ agentId, client, onRefineContext, sectionId }: BrainWorkspaceProps) {
  const section = BRAIN_SECTIONS.find((s) => s.id === sectionId) ?? BRAIN_SECTIONS[0]!;

  if (!agentId || !client) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        No project selected
      </div>
    );
  }

  return (
    <BrainEditor
      key={`${agentId}-${section.id}`}
      agentId={agentId}
      client={client}
      onRefineContext={onRefineContext}
      section={section}
    />
  );
}

// ---------------------------------------------------------------------------
// Editor for a single brain section
// ---------------------------------------------------------------------------

function BrainEditor({
  agentId,
  client,
  onRefineContext,
  section,
}: {
  agentId: string;
  client: SidecarClient;
  onRefineContext?: (sectionId: string) => void;
  section: BrainSection;
}) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [fileExists, setFileExists] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load file content
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client.readWorkspaceFile(agentId, section.filename).then(
      (result) => {
        if (cancelled) return;
        setContent(result.exists ? result.content : "");
        setFileExists(result.exists);
        setIsLoading(false);
      },
      () => {
        if (cancelled) return;
        setContent("");
        setFileExists(false);
        setIsLoading(false);
      },
    );

    return () => { cancelled = true; };
  }, [agentId, client, section.filename]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Auto-save with debounce
  const save = useCallback(
    (value: string) => {
      clearTimeout(saveTimerRef.current);
      clearTimeout(savedTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        setSaveState("saving");
        client.writeWorkspaceFile(agentId, section.filename, value).then(
          () => {
            setFileExists(true);
            setSaveState("saved");
            savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
          },
          () => {
            setSaveState("idle");
          },
        );
      }, 800);
    },
    [agentId, client, section.filename],
  );

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveState("idle");
      save(value);
    },
    [save],
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleDone = useCallback(() => {
    setIsEditing(false);
    // Flush any pending save immediately
    clearTimeout(saveTimerRef.current);
    clearTimeout(savedTimerRef.current);
    if (content) {
      setSaveState("saving");
      client.writeWorkspaceFile(agentId, section.filename, content).then(
        () => {
          setFileExists(true);
          setSaveState("saved");
          savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
        },
        () => setSaveState("idle"),
      );
    }
  }, [agentId, client, content, section.filename]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          const newContent = content
            ? `${content}\n\n---\n\n## Imported: ${file.name}\n\n${text}`
            : text;
          setContent(newContent);
          save(newContent);
          setIsEditing(true);
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [content, save],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — no file exists yet
  if (!content && !fileExists && !isEditing) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <SectionHeader section={section} saveState={saveState} fileExists={fileExists}>
          {section.id === "knowledge" ? (
            <ImportButton fileInputRef={fileInputRef} onImport={handleImport} onFileSelected={handleFileSelected} />
          ) : null}
        </SectionHeader>
        <div className="flex-1 px-5 pb-5 lg:px-6 lg:pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <LightbulbIcon className="size-4 text-amber-500/70" />
              <span className="text-xs">
                Start typing or use the template below. Changes auto-save.
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setContent(section.placeholder);
                save(section.placeholder);
              }}
              className="rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
            >
              <FlameIcon className="mb-2 size-4 text-orange-500/70" />
              <div className="font-medium text-foreground/70">Use template</div>
              <div className="mt-1 text-xs">
                Start with a pre-filled template for {section.label.toLowerCase()}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
            >
              <PencilIcon className="mb-2 size-4" />
              <div className="font-medium text-foreground/70">Write from scratch</div>
              <div className="mt-1 text-xs">
                Open the editor and start writing
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <SectionHeader section={section} saveState={saveState} fileExists={fileExists}>
        {section.id === "knowledge" ? (
          <ImportButton fileInputRef={fileInputRef} onImport={handleImport} onFileSelected={handleFileSelected} />
        ) : null}
        {fileExists && onRefineContext && isRefinableSection(section.id) ? (
          <button
            type="button"
            onClick={() => onRefineContext(section.id)}
            className="flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SparklesIcon className="size-3.5" />
            Refine context
          </button>
        ) : null}
        {isEditing ? (
          <button
            type="button"
            onClick={handleDone}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <CheckIcon className="size-3.5" />
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PencilIcon className="size-3.5" />
            Edit
          </button>
        )}
      </SectionHeader>

      <div className="flex-1 px-5 pb-5 lg:px-6 lg:pb-6">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Start writing your ${section.label.toLowerCase()} notes...`}
            className="min-h-[500px] w-full resize-none rounded-lg border border-border/50 bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring focus:ring-1 focus:ring-ring/30"
          />
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/80 [&_p]:mb-3 [&_ul]:text-sm [&_ul]:text-foreground/80 [&_ul]:mb-3 [&_ul]:ml-1 [&_ol]:text-sm [&_ol]:text-foreground/80 [&_ol]:mb-3 [&_li]:mb-1.5 [&_li]:leading-relaxed [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_hr]:border-border/40 [&_hr]:my-6 [&_table]:w-full [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:pb-2 [&_th]:border-b [&_td]:text-sm [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border/30 [&_blockquote]:border-l-2 [&_blockquote]:border-border/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function SectionHeader({
  section,
  saveState,
  fileExists,
  children,
}: {
  section: BrainSection;
  saveState: "idle" | "saving" | "saved";
  fileExists: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent">
          <section.icon className="size-4.5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{section.label}</h2>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" ? (
            <>
              <LoaderCircleIcon className="size-3 animate-spin" />
              <span>Saving...</span>
            </>
          ) : saveState === "saved" ? (
            <>
              <CheckIcon className="size-3 text-emerald-500" />
              <span className="text-emerald-500">Saved</span>
            </>
          ) : fileExists ? (
            <span className="text-muted-foreground/50">{section.filename}</span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function ImportButton({
  fileInputRef,
  onImport,
  onFileSelected,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImport: () => void;
  onFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onImport}
        className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <FileUpIcon className="size-3.5" />
        Import file
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.json,.yaml,.yml,.csv,.xml,.html,.htm"
        className="hidden"
        onChange={onFileSelected}
      />
    </>
  );
}
