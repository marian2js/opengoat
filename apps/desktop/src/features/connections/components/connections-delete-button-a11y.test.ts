import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceSrc = readFileSync(
  resolve(import.meta.dirname, "ConnectionsWorkspace.tsx"),
  "utf-8",
);

const messagingSrc = readFileSync(
  resolve(import.meta.dirname, "MessagingConnectionsPanel.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: The provider table delete button has aria-label="Remove connection"
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace delete button has aria-label=\"Remove connection\"", () => {
  // Find the Trash2 button region
  const trashIdx = workspaceSrc.indexOf("<Trash2Icon");
  assert.ok(trashIdx !== -1, "Trash2Icon must exist in ConnectionsWorkspace");

  // Look at the surrounding Button that contains the Trash2Icon
  const regionStart = workspaceSrc.lastIndexOf("<Button", trashIdx);
  const regionEnd = workspaceSrc.indexOf("</Button>", trashIdx);
  const buttonBlock = workspaceSrc.slice(regionStart, regionEnd);

  assert.ok(
    buttonBlock.includes('aria-label="Remove connection"'),
    "Delete button in ConnectionsWorkspace must have aria-label=\"Remove connection\"",
  );
});

void test("MessagingConnectionsPanel delete button has aria-label=\"Remove connection\"", () => {
  const trashIdx = messagingSrc.indexOf("<Trash2Icon");
  assert.ok(trashIdx !== -1, "Trash2Icon must exist in MessagingConnectionsPanel");

  const regionStart = messagingSrc.lastIndexOf("<Button", trashIdx);
  const regionEnd = messagingSrc.indexOf("</Button>", trashIdx);
  const buttonBlock = messagingSrc.slice(regionStart, regionEnd);

  assert.ok(
    buttonBlock.includes('aria-label="Remove connection"'),
    "Delete button in MessagingConnectionsPanel must have aria-label=\"Remove connection\"",
  );
});

// ---------------------------------------------------------------------------
// AC2: The button has title="Remove connection" (shows tooltip on hover)
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace delete button has title=\"Remove connection\"", () => {
  const trashIdx = workspaceSrc.indexOf("<Trash2Icon");
  const regionStart = workspaceSrc.lastIndexOf("<Button", trashIdx);
  const regionEnd = workspaceSrc.indexOf("</Button>", trashIdx);
  const buttonBlock = workspaceSrc.slice(regionStart, regionEnd);

  assert.ok(
    buttonBlock.includes('title="Remove connection"'),
    "Delete button in ConnectionsWorkspace must have title=\"Remove connection\"",
  );
});

void test("MessagingConnectionsPanel delete button has title=\"Remove connection\"", () => {
  const trashIdx = messagingSrc.indexOf("<Trash2Icon");
  const regionStart = messagingSrc.lastIndexOf("<Button", trashIdx);
  const regionEnd = messagingSrc.indexOf("</Button>", trashIdx);
  const buttonBlock = messagingSrc.slice(regionStart, regionEnd);

  assert.ok(
    buttonBlock.includes('title="Remove connection"'),
    "Delete button in MessagingConnectionsPanel must have title=\"Remove connection\"",
  );
});

// ---------------------------------------------------------------------------
// AC3: No visual layout changes — icon stays size-3
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace delete icon remains size-3", () => {
  const trashIdx = workspaceSrc.indexOf("<Trash2Icon");
  const regionStart = workspaceSrc.lastIndexOf("<Button", trashIdx);
  const regionEnd = workspaceSrc.indexOf("</Button>", trashIdx);
  const buttonBlock = workspaceSrc.slice(regionStart, regionEnd);

  assert.ok(
    buttonBlock.includes("size-3"),
    "Trash icon must remain size-3 in ConnectionsWorkspace",
  );
});

void test("MessagingConnectionsPanel delete icon remains size-3", () => {
  const trashIdx = messagingSrc.indexOf("<Trash2Icon");
  const regionStart = messagingSrc.lastIndexOf("<Button", trashIdx);
  const regionEnd = messagingSrc.indexOf("</Button>", trashIdx);
  const buttonBlock = messagingSrc.slice(regionStart, regionEnd);

  assert.ok(
    buttonBlock.includes("size-3"),
    "Trash icon must remain size-3 in MessagingConnectionsPanel",
  );
});
