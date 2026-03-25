import {
  BookOpenIcon,
  BookmarkIcon,
  BrainIcon,
  CheckIcon,
  DatabaseIcon,
  FileUpIcon,
  FlameIcon,
  LayersIcon,
  LightbulbIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PackageIcon,
  PencilIcon,
  ScaleIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StickyNoteIcon,
  StoreIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SidecarClient } from "@/lib/sidecar/client";
import { isRefinableSection } from "@/features/brain/lib/refine-context-prompt";
import { OperatingMemorySection } from "./OperatingMemorySection";

/**
 * Strip the leading h1 heading from markdown content.
 * Brain pages already render a page header (h2 with icon and subtitle),
 * so the markdown h1 (e.g. "# PRODUCT") is redundant.
 */
function stripLeadingH1(md: string): string {
  return md.replace(/^#\s+.+\n*/, "");
}

/**
 * Detect which h2 sections in Knowledge markdown are empty.
 * A section is empty if it contains no non-whitespace content
 * between its heading and the next heading (or end of file).
 */
function getEmptyKnowledgeSections(content: string): { references: boolean; notes: boolean } {
  const lines = content.split("\n");
  let inReferences = false;
  let inNotes = false;
  let referencesExists = false;
  let notesExists = false;
  let referencesHasContent = false;
  let notesHasContent = false;

  for (const line of lines) {
    if (/^##\s+References/i.test(line)) {
      inReferences = true;
      inNotes = false;
      referencesExists = true;
      continue;
    }
    if (/^##\s+Notes/i.test(line)) {
      inNotes = true;
      inReferences = false;
      notesExists = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      inReferences = false;
      inNotes = false;
      continue;
    }
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("---")) {
      // Treat bare list markers (e.g. "-", "* ", "1.") as empty — no meaningful content
      const isBareMarker = /^[-*+]\s*$/.test(trimmed) || /^\d+\.\s*$/.test(trimmed);
      if (!isBareMarker) {
        if (inReferences) referencesHasContent = true;
        if (inNotes) notesHasContent = true;
      }
    }
  }

  return {
    references: referencesExists && !referencesHasContent,
    notes: notesExists && !notesHasContent,
  };
}

/**
 * Known template descriptions for Memory sections.
 * These are treated as empty — they don't count as user-added content.
 */
const MEMORY_TEMPLATE_DESCRIPTIONS: Record<string, string[]> = {
  keyDecisions: [
    "Record strategic decisions and the reasoning behind them — positioning changes, campaign strategies, product pivots.",
    "Important decisions and the reasoning behind them.",
  ],
  preferences: [
    "Define brand voice, content tone, and communication conventions the AI should follow.",
    "Coding style, communication preferences, and conventions.",
  ],
  context: [
    "Share product and market context that helps the AI provide more relevant assistance.",
    "Background information that helps the AI assist more effectively.",
  ],
};

function isTemplateDescription(section: string, text: string): boolean {
  const templates = MEMORY_TEMPLATE_DESCRIPTIONS[section];
  return templates ? templates.some((t) => text === t) : false;
}

/**
 * Detect which h2 sections in Memory markdown are empty.
 * Checks Key Decisions, Preferences, and Context sections.
 * Template descriptions are not counted as user content.
 */
function getEmptyMemorySections(content: string): {
  keyDecisions: boolean;
  preferences: boolean;
  context: boolean;
} {
  const lines = content.split("\n");
  let currentSection: "keyDecisions" | "preferences" | "context" | null = null;
  const exists = { keyDecisions: false, preferences: false, context: false };
  const hasContent = { keyDecisions: false, preferences: false, context: false };

  for (const line of lines) {
    if (/^##\s+Key Decisions/i.test(line)) {
      currentSection = "keyDecisions";
      exists.keyDecisions = true;
      continue;
    }
    if (/^##\s+Preferences/i.test(line)) {
      currentSection = "preferences";
      exists.preferences = true;
      continue;
    }
    if (/^##\s+Context/i.test(line)) {
      currentSection = "context";
      exists.context = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      currentSection = null;
      continue;
    }
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("---") && currentSection) {
      // Treat bare list markers as empty
      const isBareMarker = /^[-*+]\s*$/.test(trimmed) || /^\d+\.\s*$/.test(trimmed);
      if (!isBareMarker && !isTemplateDescription(currentSection, trimmed)) {
        hasContent[currentSection] = true;
      }
    }
  }

  return {
    keyDecisions: exists.keyDecisions && !hasContent.keyDecisions,
    preferences: exists.preferences && !hasContent.preferences,
    context: exists.context && !hasContent.context,
  };
}

/**
 * Replace old developer-oriented boilerplate descriptions in Memory markdown
 * with marketing-domain language. Only replaces exact known boilerplate lines.
 */
function migrateMemoryBoilerplate(content: string): string {
  const replacements: [string, string][] = [
    [
      "Important decisions and the reasoning behind them.",
      "Record strategic decisions and the reasoning behind them — positioning changes, campaign strategies, product pivots.",
    ],
    [
      "Coding style, communication preferences, and conventions.",
      "Define brand voice, content tone, and communication conventions the AI should follow.",
    ],
    [
      "Background information that helps the AI assist more effectively.",
      "Share product and market context that helps the AI provide more relevant assistance.",
    ],
  ];

  let result = content;
  for (const [oldText, newText] of replacements) {
    result = result.replace(oldText, newText);
  }
  return result;
}

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
    label: "Company Context",
    filename: "MEMORY.md",
    icon: BrainIcon,
    description: "Product details, brand positioning, and company background",
    placeholder: `# Company Context

## Key Decisions
Record strategic decisions and the reasoning behind them — positioning changes, campaign strategies, product pivots.

## Preferences
Define brand voice, content tone, and communication conventions the AI should follow.

## Context
Share product and market context that helps the AI provide more relevant assistance.`,
  },
  {
    id: "operating-memory",
    label: "Saved Guidance",
    filename: "",
    icon: DatabaseIcon,
    description: "Preferences, constraints, and decisions the system uses to stay aligned",
    placeholder: "",
  },
  {
    id: "knowledge",
    label: "Knowledge Base",
    filename: "KNOWLEDGE.md",
    icon: BookOpenIcon,
    description: "Domain knowledge, documentation, and imported references",
    placeholder: `# Knowledge Base

Import product docs, competitor research, market data, or any reference material that helps the AI provide informed recommendations.

## References
Add links to key documents, research reports, and external resources.

## Notes
Capture domain insights, meeting takeaways, and strategic observations.`,
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

  if (section.id === "operating-memory") {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-border/20 px-5 py-4 lg:px-6">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
            <DatabaseIcon className="size-3.5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold tracking-tight">{section.label}</h2>
            <p className="text-[11px] text-muted-foreground/70">{section.description}</p>
          </div>
        </div>
        <OperatingMemorySection agentId={agentId} client={client} />
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
        let loaded = result.exists ? result.content : "";

        // Migrate old developer-oriented boilerplate in Memory files
        if (section.id === "memory" && loaded) {
          const migrated = migrateMemoryBoilerplate(loaded);
          if (migrated !== loaded) {
            loaded = migrated;
            client.writeWorkspaceFile(agentId, section.filename, migrated);
          }
        }

        setContent(loaded);
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
    const useTemplate = () => {
      setContent(section.placeholder);
      save(section.placeholder);
    };
    const writeFromScratch = () => setIsEditing(true);

    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <SectionHeader section={section} saveState={saveState} fileExists={fileExists}>
          {section.id === "knowledge" ? (
            <ImportButton fileInputRef={fileInputRef} onImport={handleImport} onFileSelected={handleFileSelected} />
          ) : null}
        </SectionHeader>
        <div className="flex-1 px-5 pb-5 lg:px-6 lg:pb-6">
          {section.id === "memory" ? (
            <MemoryEmptyState onUseTemplate={useTemplate} onWriteFromScratch={writeFromScratch} />
          ) : section.id === "knowledge" ? (
            <KnowledgeEmptyState onUseTemplate={useTemplate} onWriteFromScratch={writeFromScratch} onImport={handleImport} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <LightbulbIcon className="size-4 text-amber-500/70" />
                <span className="text-xs">
                  Start typing or use the template below. Changes auto-save.
                </span>
              </div>

              <button
                type="button"
                onClick={useTemplate}
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
                onClick={writeFromScratch}
                className="rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
              >
                <PencilIcon className="mb-2 size-4" />
                <div className="font-medium text-foreground/70">Write from scratch</div>
                <div className="mt-1 text-xs">
                  Open the editor and start writing
                </div>
              </button>
            </div>
          )}
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

      <div className="flex-1 px-5 pb-5 lg:px-8 lg:pb-6 xl:px-10">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Start writing your ${section.label.toLowerCase()} notes...`}
            className="min-h-[500px] w-full resize-none rounded-lg border border-border/50 bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring focus:ring-1 focus:ring-ring/30"
          />
        ) : section.id === "knowledge" ? (
          <KnowledgeContentView content={content} onImport={handleImport} />
        ) : section.id === "memory" ? (
          <MemoryContentView content={content} onEdit={() => setIsEditing(true)} />
        ) : (
          <div className={KNOWLEDGE_PROSE_CLASSES}>
            <Markdown remarkPlugins={[remarkGfm]}>{stripLeadingH1(content)}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section-specific empty states
// ---------------------------------------------------------------------------

const memorySubsections = [
  {
    icon: ScaleIcon,
    title: "Key Decisions",
    description: "Record strategic decisions so the AI references them in future conversations. Product pivots, positioning changes, and campaign strategies will appear here.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Preferences",
    description: "Define brand voice, content tone, and communication conventions. The AI will follow these preferences across all interactions.",
  },
  {
    icon: LayersIcon,
    title: "Context",
    description: "Share product and market context that helps the AI provide more relevant, informed assistance.",
  },
];

const knowledgeSubsections = [
  {
    icon: BookmarkIcon,
    title: "References",
    description: "Import product docs, brand guidelines, competitive research, or market data. The AI uses these to ground its recommendations in real data.",
  },
  {
    icon: StickyNoteIcon,
    title: "Notes",
    description: "Capture domain insights, meeting takeaways, and strategic observations that guide AI conversations.",
  },
];

function MemoryEmptyState({
  onUseTemplate,
  onWriteFromScratch,
}: {
  onUseTemplate: () => void;
  onWriteFromScratch: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <LightbulbIcon className="size-4 text-amber-500/70" />
        <span className="text-xs">
          Add decisions, preferences, and context to help your AI stay aligned with your company.
        </span>
      </div>

      <div className="grid gap-3">
        {memorySubsections.map((sub) => (
          <div
            key={sub.title}
            className="memory-subsection rounded-lg border border-dashed border-border/40 p-5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/50">
                <sub.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground/80">{sub.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onUseTemplate}
          className="flex-1 rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
        >
          <FlameIcon className="mb-2 size-4 text-orange-500/70" />
          <div className="font-medium text-foreground/70">Use template</div>
          <div className="mt-1 text-xs">Start with a pre-filled template for company context</div>
        </button>
        <button
          type="button"
          onClick={onWriteFromScratch}
          className="flex-1 rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
        >
          <PencilIcon className="mb-2 size-4" />
          <div className="font-medium text-foreground/70">Write from scratch</div>
          <div className="mt-1 text-xs">Open the editor and start writing</div>
        </button>
      </div>
    </div>
  );
}

function KnowledgeEmptyState({
  onUseTemplate,
  onWriteFromScratch,
  onImport,
}: {
  onUseTemplate: () => void;
  onWriteFromScratch: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <LightbulbIcon className="size-4 text-amber-500/70" />
        <span className="text-xs">
          Import docs, research, and references to give the AI deeper domain knowledge.
        </span>
      </div>

      <button
        type="button"
        onClick={onImport}
        className="knowledge-subsection flex items-center gap-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FileUpIcon className="size-5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground/90">Import your first file</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Upload product docs, research reports, or reference materials (.md, .txt, .json, .csv)
          </div>
        </div>
      </button>

      <div className="grid gap-3">
        {knowledgeSubsections.map((sub) => (
          <div
            key={sub.title}
            className="knowledge-subsection rounded-lg border border-dashed border-border/40 p-5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/50">
                <sub.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground/80">{sub.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onUseTemplate}
          className="flex-1 rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
        >
          <FlameIcon className="mb-2 size-4 text-orange-500/70" />
          <div className="font-medium text-foreground/70">Use template</div>
          <div className="mt-1 text-xs">Start with a pre-filled template for knowledge</div>
        </button>
        <button
          type="button"
          onClick={onWriteFromScratch}
          className="flex-1 rounded-lg border border-dashed border-border/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-accent/30"
        >
          <PencilIcon className="mb-2 size-4" />
          <div className="font-medium text-foreground/70">Write from scratch</div>
          <div className="mt-1 text-xs">Open the editor and start writing</div>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge content view — renders markdown with per-category empty states
// ---------------------------------------------------------------------------

const KNOWLEDGE_PROSE_CLASSES =
  "prose prose-sm dark:prose-invert max-w-prose [&>h1:first-child]:hidden [&_h1]:text-lg [&_h1]:font-display [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-0 [&_h2]:font-mono [&_h2]:text-[11px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-[0.08em] [&_h2]:text-primary [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-border/20 [&_h3]:text-[14px] [&_h3]:font-display [&_h3]:font-bold [&_h3]:tracking-tight [&_h3]:mb-2 [&_h3]:mt-6 [&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:mb-2 [&_h4]:mt-6 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-foreground/80 [&_p]:mb-3 [&_ul]:text-[13px] [&_ul]:text-foreground/80 [&_ul]:mb-3 [&_ul]:pl-4 [&_ol]:text-[13px] [&_ol]:text-foreground/80 [&_ol]:mb-3 [&_ol]:pl-4 [&_li]:mb-1.5 [&_li]:leading-relaxed [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:text-[11px] [&_code]:font-mono [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-[11px] [&_pre]:font-mono [&_pre]:overflow-x-auto [&_hr]:border-border/30 [&_hr]:my-6 [&_table]:w-full [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:pb-2 [&_th]:border-b [&_td]:text-[13px] [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border/20 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground";

function KnowledgeInlineEmpty({
  icon: Icon,
  title,
  helperText,
  onImport,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  helperText: string;
  onImport?: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/15 bg-muted/20 px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
        <Icon className="size-4 text-muted-foreground/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-muted-foreground/70">{title}</p>
        <p className="text-xs text-muted-foreground/50">{helperText}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onImport ? (
          <button
            type="button"
            onClick={onImport}
            className="flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[11px] text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            <FileUpIcon className="size-3" />
            Import
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => { window.location.hash = "#chat"; }}
          className="flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[11px] text-primary/70 transition-colors hover:bg-primary/5 hover:text-primary"
        >
          <MessageSquareIcon className="size-3" />
          Chat
        </button>
      </div>
    </div>
  );
}

function KnowledgeContentView({ content, onImport }: { content: string; onImport?: () => void }) {
  const stripped = stripLeadingH1(content);
  const empty = getEmptyKnowledgeSections(stripped);
  const hasEmptySections = empty.references || empty.notes;

  if (!hasEmptySections) {
    return (
      <div className={KNOWLEDGE_PROSE_CLASSES}>
        <Markdown remarkPlugins={[remarkGfm]}>{stripped}</Markdown>
      </div>
    );
  }

  // Split content into sections so we can inject inline empty states
  const sections: Array<{ heading: string | null; body: string }> = [];
  const lines = stripped.split("\n");
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      sections.push({ heading: currentHeading, body: currentBody.join("\n") });
      currentHeading = h2Match[1]!;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  sections.push({ heading: currentHeading, body: currentBody.join("\n") });

  return (
    <div className={KNOWLEDGE_PROSE_CLASSES}>
      {sections.map((sec, i) => {
        const isReferencesEmpty = empty.references && sec.heading?.match(/^References/i);
        const isNotesEmpty = empty.notes && sec.heading?.match(/^Notes/i);

        return (
          <div key={sec.heading ?? `preamble-${i}`}>
            {sec.heading ? (
              <Markdown remarkPlugins={[remarkGfm]}>{`## ${sec.heading}`}</Markdown>
            ) : null}
            {sec.body.trim() && !isReferencesEmpty && !isNotesEmpty ? (
              <Markdown remarkPlugins={[remarkGfm]}>{sec.body}</Markdown>
            ) : null}
            {isReferencesEmpty ? (
              <KnowledgeInlineEmpty
                icon={BookmarkIcon}
                title="No references imported"
                helperText="Import a file or click Edit to add links and documents."
                onImport={onImport}
              />
            ) : null}
            {isNotesEmpty ? (
              <KnowledgeInlineEmpty
                icon={StickyNoteIcon}
                title="No notes added"
                helperText="Click Edit to capture insights and observations."
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memory content view — renders markdown with per-category empty states
// ---------------------------------------------------------------------------

function MemoryInlineEmpty({
  icon: Icon,
  title,
  helperText,
  onEdit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  helperText: string;
  onEdit?: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/15 bg-muted/20 px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
        <Icon className="size-4 text-muted-foreground/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-muted-foreground/70">{title}</p>
        <p className="text-xs text-muted-foreground/50">{helperText}</p>
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[11px] text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
        >
          <PencilIcon className="size-3" />
          Edit
        </button>
      ) : null}
    </div>
  );
}

function MemoryContentView({ content, onEdit }: { content: string; onEdit?: () => void }) {
  const stripped = migrateMemoryBoilerplate(stripLeadingH1(content));
  const empty = getEmptyMemorySections(stripped);
  const hasEmptySections = empty.keyDecisions || empty.preferences || empty.context;

  if (!hasEmptySections) {
    return (
      <div className={KNOWLEDGE_PROSE_CLASSES}>
        <Markdown remarkPlugins={[remarkGfm]}>{stripped}</Markdown>
      </div>
    );
  }

  // Split content into sections so we can inject inline empty states
  const sections: Array<{ heading: string | null; body: string }> = [];
  const lines = stripped.split("\n");
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      sections.push({ heading: currentHeading, body: currentBody.join("\n") });
      currentHeading = h2Match[1]!;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  sections.push({ heading: currentHeading, body: currentBody.join("\n") });

  return (
    <div className={KNOWLEDGE_PROSE_CLASSES}>
      {sections.map((sec, i) => {
        const isKeyDecisionsEmpty = empty.keyDecisions && sec.heading?.match(/^Key Decisions/i);
        const isPreferencesEmpty = empty.preferences && sec.heading?.match(/^Preferences/i);
        const isContextEmpty = empty.context && sec.heading?.match(/^Context/i);
        const isSectionEmpty = isKeyDecisionsEmpty || isPreferencesEmpty || isContextEmpty;

        return (
          <div key={sec.heading ?? `preamble-${i}`}>
            {sec.heading ? (
              <Markdown remarkPlugins={[remarkGfm]}>{`## ${sec.heading}`}</Markdown>
            ) : null}
            {sec.body.trim() && !isSectionEmpty ? (
              <Markdown remarkPlugins={[remarkGfm]}>{sec.body}</Markdown>
            ) : null}
            {isKeyDecisionsEmpty ? (
              <MemoryInlineEmpty
                icon={ScaleIcon}
                title="No key decisions recorded yet"
                helperText="Chat with your agent or click Edit to add entries."
                onEdit={onEdit}
              />
            ) : null}
            {isPreferencesEmpty ? (
              <MemoryInlineEmpty
                icon={SlidersHorizontalIcon}
                title="No preferences set"
                helperText="Click Edit to define your brand voice and conventions."
                onEdit={onEdit}
              />
            ) : null}
            {isContextEmpty ? (
              <MemoryInlineEmpty
                icon={LayersIcon}
                title="No context added"
                helperText="Click Edit to share background context for better assistance."
                onEdit={onEdit}
              />
            ) : null}
          </div>
        );
      })}
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
    <div className="flex items-center justify-between border-b border-border/20 px-5 py-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <section.icon className="size-3.5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-sm font-bold tracking-tight">{section.label}</h2>
          <p className="text-[11px] text-muted-foreground/70">{section.description}</p>
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
            <span className="font-mono text-[10px] text-muted-foreground/40">{section.filename}</span>
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
