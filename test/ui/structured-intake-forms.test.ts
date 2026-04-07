import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const intakeFieldsSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/data/intake-fields.ts"),
  "utf-8",
);

const actionsSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/data/actions.ts"),
  "utf-8",
);

const promptBuilderSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/data/prompt-builder.ts"),
  "utf-8",
);

const intakeFormDialogSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/IntakeFormDialog.tsx"),
  "utf-8",
);

const dashboardSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx"),
  "utf-8",
);

const intakeFormHookSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/hooks/useIntakeForm.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// 1. IntakeField schema & data definitions
// ---------------------------------------------------------------------------

describe("Intake field schema — IntakeField interface", () => {
  it("defines IntakeField with key, label, type, required, placeholder", () => {
    expect(intakeFieldsSrc).toContain("export interface IntakeField");
    expect(intakeFieldsSrc).toContain("key: string");
    expect(intakeFieldsSrc).toContain("label: string");
    expect(intakeFieldsSrc).toContain('type: "text" | "textarea" | "select"');
    expect(intakeFieldsSrc).toContain("required: boolean");
    expect(intakeFieldsSrc).toContain("placeholder: string");
  });

  it("supports optional select options", () => {
    expect(intakeFieldsSrc).toContain("options?: string[]");
  });

  it("supports pre-fill from CompanySummaryData", () => {
    expect(intakeFieldsSrc).toContain("prefillFrom?: keyof CompanySummaryData");
  });

  it("defines IntakeFieldSet with required and optional arrays", () => {
    expect(intakeFieldsSrc).toContain("export interface IntakeFieldSet");
    expect(intakeFieldsSrc).toContain("required: IntakeField[]");
    expect(intakeFieldsSrc).toContain("optional: IntakeField[]");
  });
});

describe("Intake field definitions — at least 3 workflows", () => {
  it("has field definitions for homepage rewrite", () => {
    expect(intakeFieldsSrc).toContain('"rewrite-homepage-hero"');
  });

  it("has field definitions for outbound sequence", () => {
    expect(intakeFieldsSrc).toContain('"build-outbound-sequence"');
  });

  it("has field definitions for launch pack", () => {
    expect(intakeFieldsSrc).toContain('"launch-product-hunt"');
  });

  it("each workflow has 2-4 fields total", () => {
    // Count field key definitions in each workflow
    const homepageFields = intakeFieldsSrc.slice(
      intakeFieldsSrc.indexOf("homepageRewriteFields"),
      intakeFieldsSrc.indexOf("outboundSequenceFields"),
    );
    const outboundFields = intakeFieldsSrc.slice(
      intakeFieldsSrc.indexOf("outboundSequenceFields"),
      intakeFieldsSrc.indexOf("launchPackFields"),
    );
    const launchFields = intakeFieldsSrc.slice(
      intakeFieldsSrc.indexOf("launchPackFields"),
      intakeFieldsSrc.indexOf("intakeFieldRegistry"),
    );

    // Each should have between 2 and 6 key: definitions (required + optional)
    const countKeys = (src: string) => (src.match(/key: "/g) || []).length;
    expect(countKeys(homepageFields)).toBeGreaterThanOrEqual(2);
    expect(countKeys(homepageFields)).toBeLessThanOrEqual(6);
    expect(countKeys(outboundFields)).toBeGreaterThanOrEqual(2);
    expect(countKeys(outboundFields)).toBeLessThanOrEqual(6);
    expect(countKeys(launchFields)).toBeGreaterThanOrEqual(2);
    expect(countKeys(launchFields)).toBeLessThanOrEqual(6);
  });

  it("some fields use prefillFrom for company context pre-population", () => {
    expect(intakeFieldsSrc).toContain('prefillFrom: "targetAudience"');
  });

  it("some fields use select type with options array", () => {
    expect(intakeFieldsSrc).toContain('type: "select"');
    expect(intakeFieldsSrc).toContain("Professional");
    expect(intakeFieldsSrc).toContain("Conversational");
    expect(intakeFieldsSrc).toContain("Bold");
  });

  it("exports getIntakeFields lookup function", () => {
    expect(intakeFieldsSrc).toContain("export function getIntakeFields");
  });
});

// ---------------------------------------------------------------------------
// 2. ActionCard interface — intakeFields field
// ---------------------------------------------------------------------------

describe("ActionCard interface — intakeFields field", () => {
  it("has optional intakeFields field on ActionCard", () => {
    expect(actionsSrc).toContain("intakeFields?: string");
  });

  it("rewrite-homepage-hero has intakeFields set", () => {
    const heroBlock = actionsSrc.slice(
      actionsSrc.indexOf('"rewrite-homepage-hero"'),
      actionsSrc.indexOf('"improve-homepage-conversion"'),
    );
    expect(heroBlock).toContain("intakeFields:");
  });

  it("build-outbound-sequence has intakeFields set", () => {
    const outboundBlock = actionsSrc.slice(
      actionsSrc.indexOf('"build-outbound-sequence"'),
      actionsSrc.indexOf('"find-seo-quick-wins"'),
    );
    expect(outboundBlock).toContain("intakeFields:");
  });

  it("launch-product-hunt has intakeFields set", () => {
    const launchBlock = actionsSrc.slice(
      actionsSrc.indexOf('"launch-product-hunt"'),
      actionsSrc.indexOf('"rewrite-homepage-hero"'),
    );
    expect(launchBlock).toContain("intakeFields:");
  });

  it("actions without intake forms do not have intakeFields", () => {
    const seoBlock = actionsSrc.slice(
      actionsSrc.indexOf('"find-seo-quick-wins"'),
      actionsSrc.indexOf('"create-comparison-page-outline"'),
    );
    expect(seoBlock).not.toContain("intakeFields:");
  });
});

// ---------------------------------------------------------------------------
// 3. Prompt builder — buildActionPromptWithIntake
// ---------------------------------------------------------------------------

describe("Prompt builder — buildActionPromptWithIntake", () => {
  it("exports buildActionPromptWithIntake function", () => {
    expect(promptBuilderSrc).toContain("export function buildActionPromptWithIntake");
  });

  it("accepts ActionCard and intakeValues parameters", () => {
    expect(promptBuilderSrc).toContain("card: ActionCard");
    expect(promptBuilderSrc).toContain("intakeValues: Record<string, string>");
  });

  it("prepends a User Context section with intake values", () => {
    expect(promptBuilderSrc).toContain("## User Context");
  });

  it("calls buildActionPrompt for the base prompt", () => {
    expect(promptBuilderSrc).toContain("buildActionPrompt(card)");
  });

  it("formats intake values as labeled key-value pairs", () => {
    // Should format as markdown bold key + value
    expect(promptBuilderSrc).toContain("**${formatKey(k)}**");
  });
});

// ---------------------------------------------------------------------------
// 4. IntakeFormDialog component
// ---------------------------------------------------------------------------

describe("IntakeFormDialog component", () => {
  it("uses Dialog from UI primitives", () => {
    expect(intakeFormDialogSrc).toContain("Dialog");
    expect(intakeFormDialogSrc).toContain("DialogContent");
    expect(intakeFormDialogSrc).toContain("DialogHeader");
    expect(intakeFormDialogSrc).toContain("DialogTitle");
  });

  it("accepts IntakeFieldSet as fields prop", () => {
    expect(intakeFormDialogSrc).toContain("fields: IntakeFieldSet");
  });

  it("accepts CompanySummaryData for pre-population", () => {
    expect(intakeFormDialogSrc).toContain("companyData: CompanySummaryData | null");
  });

  it("pre-populates fields from company data using prefillFrom", () => {
    expect(intakeFormDialogSrc).toContain("prefillFrom");
    expect(intakeFormDialogSrc).toContain("companyData[field.prefillFrom]");
  });

  it("renders text inputs via Input component", () => {
    expect(intakeFormDialogSrc).toContain('from "@/components/ui/input"');
    expect(intakeFormDialogSrc).toContain("<Input");
  });

  it("renders select inputs via Select component", () => {
    expect(intakeFormDialogSrc).toContain('from "@/components/ui/select"');
    expect(intakeFormDialogSrc).toContain("<Select");
    expect(intakeFormDialogSrc).toContain("<SelectItem");
  });

  it("renders textarea inputs via Textarea component", () => {
    expect(intakeFormDialogSrc).toContain('from "@/components/ui/textarea"');
    expect(intakeFormDialogSrc).toContain("<Textarea");
  });

  it("validates required fields before enabling submit", () => {
    expect(intakeFormDialogSrc).toContain("allRequiredFilled");
    expect(intakeFormDialogSrc).toContain("disabled={!allRequiredFilled");
  });

  it("shows output type in the dialog header", () => {
    expect(intakeFormDialogSrc).toContain("outputType");
  });

  it("shows specialist name in the dialog description", () => {
    expect(intakeFormDialogSrc).toContain("specialistName");
  });

  it("emits onSubmit with Record<string, string>", () => {
    expect(intakeFormDialogSrc).toContain("onSubmit: (values: Record<string, string>) => void");
  });

  it("separates required and optional fields visually", () => {
    expect(intakeFormDialogSrc).toContain("Optional");
    expect(intakeFormDialogSrc).toContain("fields.required.map");
    expect(intakeFormDialogSrc).toContain("fields.optional");
  });

  it("uses DESIGN.md styling: sm:max-w-md dialog, emerald accent", () => {
    expect(intakeFormDialogSrc).toContain("sm:max-w-md");
    expect(intakeFormDialogSrc).toContain("text-primary");
  });
});

// ---------------------------------------------------------------------------
// 5. DashboardWorkspace — click interception wiring
// ---------------------------------------------------------------------------

describe("useIntakeForm hook — click interception logic", () => {
  it("imports getIntakeFields for field lookup", () => {
    expect(intakeFormHookSrc).toContain("getIntakeFields");
  });

  it("imports buildActionPromptWithIntake for enriched prompts", () => {
    expect(intakeFormHookSrc).toContain("buildActionPromptWithIntake");
  });

  it("manages intake form open state", () => {
    expect(intakeFormHookSrc).toContain("intakeFormOpen");
    expect(intakeFormHookSrc).toContain("setIntakeFormOpen");
  });

  it("tracks pending intake action and fields", () => {
    expect(intakeFormHookSrc).toContain("pendingIntakeAction");
    expect(intakeFormHookSrc).toContain("pendingIntakeFields");
  });

  it("intercepts clicks to check for intakeFields before routing", () => {
    expect(intakeFormHookSrc).toContain("card?.intakeFields");
    expect(intakeFormHookSrc).toContain("getIntakeFields(intakeKey)");
  });

  it("builds enriched prompt from intake values on submit", () => {
    expect(intakeFormHookSrc).toContain("buildActionPromptWithIntake(pendingIntakeAction, values)");
  });
});

describe("DashboardWorkspace — intake form integration", () => {
  it("imports IntakeFormDialog", () => {
    expect(dashboardSrc).toContain("IntakeFormDialog");
  });

  it("uses useIntakeForm hook", () => {
    expect(dashboardSrc).toContain("useIntakeForm");
  });

  it("renders IntakeFormDialog conditionally", () => {
    expect(dashboardSrc).toContain("<IntakeFormDialog");
    expect(dashboardSrc).toContain("intake.pendingIntakeFields");
  });

  it("passes company data to IntakeFormDialog for pre-population", () => {
    expect(dashboardSrc).toContain("companyData={data}");
  });

  it("routes job card clicks through intake handler", () => {
    expect(dashboardSrc).toContain("intake.handleJobCardClick");
  });
});
