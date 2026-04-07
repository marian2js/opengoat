import type { CompanySummaryData } from "@/features/dashboard/lib/parse-workspace-summary";

// ---------------------------------------------------------------------------
// Intake field schema
// ---------------------------------------------------------------------------

export interface IntakeField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  placeholder: string;
  options?: string[];
  /** If set, pre-fill from the matching CompanySummaryData field */
  prefillFrom?: keyof CompanySummaryData;
}

export interface IntakeFieldSet {
  required: IntakeField[];
  optional: IntakeField[];
}

// ---------------------------------------------------------------------------
// Field definitions per workflow
// ---------------------------------------------------------------------------

const homepageRewriteFields: IntakeFieldSet = {
  required: [
    {
      key: "targetBuyer",
      label: "Target buyer",
      type: "text",
      required: true,
      placeholder: "e.g. early-stage SaaS founders",
      prefillFrom: "targetAudience",
    },
    {
      key: "primaryGoal",
      label: "Primary goal",
      type: "text",
      required: true,
      placeholder: "e.g. increase demo signups, convey credibility",
    },
  ],
  optional: [
    {
      key: "tonePreference",
      label: "Tone preference",
      type: "select",
      required: false,
      placeholder: "Choose a tone",
      options: ["Professional", "Conversational", "Bold", "Technical"],
    },
    {
      key: "currentHeadlinePain",
      label: "Current headline pain point",
      type: "textarea",
      required: false,
      placeholder: "What's wrong with your current headline?",
    },
  ],
};

const outboundSequenceFields: IntakeFieldSet = {
  required: [
    {
      key: "targetBuyer",
      label: "Target buyer",
      type: "text",
      required: true,
      placeholder: "e.g. VP of Marketing at mid-market B2B",
      prefillFrom: "targetAudience",
    },
    {
      key: "offerHook",
      label: "Offer or hook",
      type: "text",
      required: true,
      placeholder: "e.g. free audit, case study, early access",
    },
  ],
  optional: [
    {
      key: "competitor",
      label: "Competitor to differentiate from",
      type: "text",
      required: false,
      placeholder: "e.g. HubSpot, Mailchimp",
    },
    {
      key: "tonePreference",
      label: "Tone preference",
      type: "select",
      required: false,
      placeholder: "Choose a tone",
      options: ["Professional", "Conversational", "Bold", "Technical"],
    },
  ],
};

const launchPackFields: IntakeFieldSet = {
  required: [
    {
      key: "launchTiming",
      label: "Launch timing",
      type: "text",
      required: true,
      placeholder: "e.g. next Tuesday, mid-April, Q2 2026",
    },
    {
      key: "primaryAudience",
      label: "Primary audience",
      type: "text",
      required: true,
      placeholder: "e.g. indie hackers, SaaS founders",
      prefillFrom: "targetAudience",
    },
  ],
  optional: [
    {
      key: "keyDifferentiator",
      label: "Key differentiator",
      type: "textarea",
      required: false,
      placeholder: "What makes this product different?",
      prefillFrom: "valueProposition",
    },
    {
      key: "competitorSet",
      label: "Competitor set",
      type: "textarea",
      required: false,
      placeholder: "e.g. Notion, Linear, Coda",
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry — maps action IDs to their intake field sets
// ---------------------------------------------------------------------------

export const intakeFieldRegistry: Record<string, IntakeFieldSet> = {
  "rewrite-homepage-hero": homepageRewriteFields,
  "build-outbound-sequence": outboundSequenceFields,
  "launch-product-hunt": launchPackFields,
};

/**
 * Returns the intake field set for a given action ID, or null if the action
 * has no structured intake form.
 */
export function getIntakeFields(actionId: string): IntakeFieldSet | null {
  return intakeFieldRegistry[actionId] ?? null;
}
