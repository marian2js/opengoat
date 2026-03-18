import { type UIMessage } from "ai";
import { chatActivitySchema, type ChatActivity } from "@opengoat/contracts";

export const chatDataPartSchemas = {
  activity: chatActivitySchema,
};

export type ChatUIMessage = UIMessage<unknown, { activity: ChatActivity }>;

export function getTextParts(message: ChatUIMessage): string[] {
  return message.parts.flatMap((part) =>
    part.type === "text" && part.text.trim().length > 0 ? [part.text] : [],
  );
}

export function getReasoningText(message: ChatUIMessage): string {
  return message.parts
    .flatMap((part) =>
      part.type === "reasoning" && part.text.trim().length > 0 ? [part.text] : [],
    )
    .join("\n")
    .trim();
}

export function getActivityParts(message: ChatUIMessage): ChatActivity[] {
  return message.parts
    .flatMap((part) => (part.type === "data-activity" ? [part.data] : []))
    .slice()
    .sort((left, right) => {
      const sequenceDelta = (left.sequence ?? 0) - (right.sequence ?? 0);
      if (sequenceDelta !== 0) {
        return sequenceDelta;
      }
      return left.id.localeCompare(right.id);
    });
}
