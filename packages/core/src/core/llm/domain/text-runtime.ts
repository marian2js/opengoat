export type OpenAiCompatibleApiStyle = "responses" | "chat";

export interface OpenAiCompatibleTextRequest {
  providerName: string;
  apiKey: string;
  model: string;
  message: string;
  systemPrompt?: string;
  baseURL: string;
  style: OpenAiCompatibleApiStyle;
  requestTimeoutMs?: number;
  endpointOverride?: string;
  endpointPathOverride?: string;
  headers?: Record<string, string>;
}

export interface OpenAiCompatibleTextResult {
  text: string;
  providerSessionId?: string;
}

export interface OpenAiCompatibleTextRuntime {
  generateText(request: OpenAiCompatibleTextRequest): Promise<OpenAiCompatibleTextResult>;
}
