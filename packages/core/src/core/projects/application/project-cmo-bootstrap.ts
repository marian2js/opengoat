import { readFileSync } from "node:fs";
import { INTERNAL_SESSION_PREFIX } from "../../sessions/index.js";

export interface ProjectCmoBootstrapPrompt {
  id: string;
  name: string;
  sessionRef: string;
  message: string;
}

const PROJECT_CMO_BOOTSTRAP_PROMPT_DEFINITIONS = [
  {
    id: "product",
    name: "cmo-bootstrap-product-prompt",
    templateUrl: new URL(
      "../../templates/assets/projects/cmo-bootstrap-product-prompt.md",
      import.meta.url,
    ),
  },
  {
    id: "market",
    name: "cmo-bootstrap-market-prompt",
    templateUrl: new URL(
      "../../templates/assets/projects/cmo-bootstrap-market-prompt.md",
      import.meta.url,
    ),
  },
  {
    id: "growth",
    name: "cmo-bootstrap-growth-prompt",
    templateUrl: new URL(
      "../../templates/assets/projects/cmo-bootstrap-growth-prompt.md",
      import.meta.url,
    ),
  },
] as const;

const cachedProjectCmoBootstrapPromptTemplates = new Map<string, string>();

export function listProjectCmoBootstrapPrompts(
  projectUrl: string,
): ProjectCmoBootstrapPrompt[] {
  const normalizedProjectUrl = projectUrl.trim();
  return PROJECT_CMO_BOOTSTRAP_PROMPT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    name: definition.name,
    sessionRef: buildProjectCmoBootstrapSessionRef(definition.name),
    message: readProjectCmoBootstrapPromptTemplate(definition).replaceAll(
      "{{URL}}",
      normalizedProjectUrl,
    ),
  }));
}

function buildProjectCmoBootstrapSessionRef(promptName: string): string {
  return `${INTERNAL_SESSION_PREFIX}${promptName}`;
}

function readProjectCmoBootstrapPromptTemplate(definition: {
  name: string;
  templateUrl: URL;
}): string {
  const cached = cachedProjectCmoBootstrapPromptTemplates.get(definition.name);
  if (cached !== undefined) {
    return cached;
  }

  const template = readFileSync(definition.templateUrl, "utf8");
  cachedProjectCmoBootstrapPromptTemplates.set(definition.name, template);
  return template;
}
