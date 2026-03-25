export type ChannelType = "desktop" | "telegram" | "whatsapp";

const DESKTOP_PROMPT = `You are responding on the OpenGoat desktop app.
Use full Markdown formatting including headers, bold, lists, and structured output.
You may produce rich, detailed, full-length responses with multiple sections.
Include Board links, inline structured outputs, and panels where helpful.
There are no length constraints — provide comprehensive, well-organized content.`;

const TELEGRAM_PROMPT = `You are responding on Telegram, a mobile messaging surface.
Keep responses concise — aim for under 800 characters when possible.
Use short sections with clear headers (bold text, not Markdown headers).
Present options as numbered lists so they work well as button-friendly choices.
Use one follow-up question at a time, not multiple.
Avoid tables, HTML, or complex Markdown — Telegram supports only basic formatting.

When the output would be long (full page rewrite, detailed comparison, multi-option draft), provide a brief summary here and tell the user the full version is available in the OpenGoat desktop app. For example: "I created 3 hero options — here's a quick preview. The full drafts are saved in the desktop app."`;

const WHATSAPP_PROMPT = `You are responding on WhatsApp, a mobile messaging surface.
Keep responses short — use brief paragraphs of 2-3 sentences each.
Use numbered options (1, 2, 3) instead of bullet points.
Keep lists compact — no more than 5 items.
Ask only one follow-up question at a time.
Do not use Markdown headers, links, or complex formatting — WhatsApp only supports *bold* and _italic_.

When the output would be long (full page rewrite, detailed comparison, multi-option draft), provide a concise summary here and direct the user to the OpenGoat desktop app for the full version. For example: "I drafted 3 hero options and saved them in the desktop app. Here's a quick look at option 1."`;

const CHANNEL_PROMPTS: Record<ChannelType, string> = {
  desktop: DESKTOP_PROMPT,
  telegram: TELEGRAM_PROMPT,
  whatsapp: WHATSAPP_PROMPT,
};

const CHANNEL_TOKEN_BUDGETS: Record<ChannelType, number> = {
  desktop: 2000,
  telegram: 800,
  whatsapp: 800,
};

export function getChannelPrompt(channelType: ChannelType): string {
  const prompt = CHANNEL_PROMPTS[channelType];
  return `<channel-instructions>\n${prompt}\n</channel-instructions>`;
}

export function getTokenBudgetForChannel(
  channelType: ChannelType | undefined,
): number {
  return CHANNEL_TOKEN_BUDGETS[channelType ?? "desktop"];
}
