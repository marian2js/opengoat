export interface SpecialistContextInput {
  memories: Array<{ content: string }>;
  specialistName: string;
}

export function composeSpecialistContext(input: SpecialistContextInput): string {
  const { memories, specialistName } = input;
  if (memories.length === 0) return "";

  const lines: string[] = [
    `## Specialist Guidelines — ${specialistName}`,
    "",
  ];
  for (const mem of memories) {
    lines.push(`- ${mem.content}`);
  }

  const body = lines.join("\n");
  return `<specialist-context>\n${body}\n</specialist-context>`;
}
