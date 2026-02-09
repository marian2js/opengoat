export type OpenAiCompatibleApiStyle = "responses" | "chat";

export interface OpenAiCompatibleImageInput {
  image: string | URL;
  mediaType?: string;
}

export interface OpenAiCompatibleTextRequest {
  providerName: string;
  apiKey: string;
  model: string;
  message: string;
  images?: OpenAiCompatibleImageInput[];
  systemPrompt?: string;
  baseURL: string;
  style: OpenAiCompatibleApiStyle;
  requestTimeoutMs?: number;
  endpointOverride?: string;
  endpointPathOverride?: string;
  headers?: Record<string, string>;
  abortSignal?: AbortSignal;
}

export interface OpenAiCompatibleTextResult {
  text: string;
  providerSessionId?: string;
}

export interface OpenAiCompatibleTextRuntime {
  generateText(request: OpenAiCompatibleTextRequest): Promise<OpenAiCompatibleTextResult>;
}
