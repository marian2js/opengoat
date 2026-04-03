export interface SpecialistContextInput {
  instructionTemplate?: string;
  memories: Array<{ content: string }>;
  specialistName: string;
}

export function composeSpecialistContext(input: SpecialistContextInput): string {
  const { instructionTemplate, memories, specialistName } = input;
  if (!instructionTemplate && memories.length === 0) return "";

  const lines: string[] = [];

  if (instructionTemplate) {
    lines.push(`## Specialist Instructions — ${specialistName}`, "");
    lines.push(instructionTemplate);
  }

  if (memories.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(`## Specialist Guidelines — ${specialistName}`, "");
    for (const mem of memories) {
      lines.push(`- ${mem.content}`);
    }
  }

  const body = lines.join("\n");
  return `<specialist-context>\n${body}\n</specialist-context>`;
}
