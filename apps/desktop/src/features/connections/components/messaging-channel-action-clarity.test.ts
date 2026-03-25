import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "MessagingConnectionsPanel.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Each messaging channel action button has a visible text label or tooltip
// ---------------------------------------------------------------------------

void test("Settings/details button has a visible text label", () => {
  assert.ok(
    src.includes(">Details<") || src.includes(">Settings<") || src.includes('"Details"') || src.includes("Details</"),
    "The settings/details button must have a visible text label",
  );
});

void test("Delete button has a visible text label", () => {
  assert.ok(
    src.includes(">Remove<") || src.includes(">Delete<") || src.includes("Remove</") || src.includes("Delete</"),
    "The delete button must have a visible text label",
  );
});

// ---------------------------------------------------------------------------
// AC2: Primary action uses emerald accent color
// ---------------------------------------------------------------------------

void test("Details button uses emerald/primary accent styling", () => {
  // The settings/details button should use the primary/emerald color
  assert.ok(
    src.includes("text-primary") || src.includes("text-emerald"),
    "The details button must use emerald/primary accent color",
  );
});

// ---------------------------------------------------------------------------
// AC3: Destructive action uses red semantic color
// ---------------------------------------------------------------------------

void test("Delete button uses destructive/red semantic color", () => {
  assert.ok(
    src.includes("text-destructive"),
    "The delete button must use destructive/red semantic color",
  );
});

// ---------------------------------------------------------------------------
// AC4: Buttons have aria-label for screen reader accessibility
// ---------------------------------------------------------------------------

void test("Settings/details button has aria-label", () => {
  assert.ok(
    src.includes('aria-label') && (src.includes("details") || src.includes("Details") || src.includes("settings")),
    "The settings/details button must have an aria-label for accessibility",
  );
});

void test("Delete button has aria-label for accessibility", () => {
  // Must contain aria-label with remove/delete wording
  const ariaLabelMatch = src.match(/aria-label="[^"]*[Rr]emove[^"]*"/);
  const ariaLabelMatch2 = src.match(/aria-label="[^"]*[Dd]elete[^"]*"/);
  assert.ok(
    ariaLabelMatch || ariaLabelMatch2,
    "The delete button must have an aria-label describing its remove/delete purpose",
  );
});

// ---------------------------------------------------------------------------
// AC5: Button purpose is clear without hovering (text labels present)
// ---------------------------------------------------------------------------

void test("Buttons have inline text labels not just tooltips", () => {
  // The MessagingConnectionRow section should have text like "Details" and "Remove"
  // alongside the icons, making purpose clear without needing to hover
  const rowSection = src.slice(
    src.indexOf("function MessagingConnectionRow"),
    src.indexOf("function WhatsAppConnectionDetail"),
  );
  assert.ok(
    (rowSection.includes("Details") || rowSection.includes("Settings")) &&
    (rowSection.includes("Remove") || rowSection.includes("Delete")),
    "MessagingConnectionRow must contain visible text labels for both actions",
  );
});

void test("Buttons have minimum hit target height of 32px (h-8 or larger)", () => {
  const rowSection = src.slice(
    src.indexOf("function MessagingConnectionRow"),
    src.indexOf("function WhatsAppConnectionDetail"),
  );
  // h-7 = 28px, h-8 = 32px. Buttons should be at least h-8
  assert.ok(
    rowSection.includes("h-8") || rowSection.includes("h-9") || rowSection.includes("h-10"),
    "Action buttons must have at least 32px (h-8) height for accessibility",
  );
});
