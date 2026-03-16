import { readFileSync } from "node:fs";
import { INTERNAL_SESSION_PREFIX } from "../../sessions/index.js";

const PROJECT_CMO_BOOTSTRAP_SESSION_REF = `${INTERNAL_SESSION_PREFIX}project-cmo-bootstrap`;
const PROJECT_CMO_BOOTSTRAP_PROMPT_TEMPLATE_URL = new URL(
  "../../templates/assets/projects/cmo-bootstrap-prompt.md",
  import.meta.url,
);

let cachedProjectCmoBootstrapPromptTemplate: string | undefined;

export function buildProjectCmoBootstrapSessionRef(): string {
  return PROJECT_CMO_BOOTSTRAP_SESSION_REF;
}

export function renderProjectCmoBootstrapPrompt(projectUrl: string): string {
  const normalizedProjectUrl = projectUrl.trim();
  return readProjectCmoBootstrapPromptTemplate().replaceAll(
    "{{URL}}",
    normalizedProjectUrl,
  );
}

function readProjectCmoBootstrapPromptTemplate(): string {
  if (cachedProjectCmoBootstrapPromptTemplate !== undefined) {
    return cachedProjectCmoBootstrapPromptTemplate;
  }

  cachedProjectCmoBootstrapPromptTemplate = readFileSync(
    PROJECT_CMO_BOOTSTRAP_PROMPT_TEMPLATE_URL,
    "utf8",
  );
  return cachedProjectCmoBootstrapPromptTemplate;
}
