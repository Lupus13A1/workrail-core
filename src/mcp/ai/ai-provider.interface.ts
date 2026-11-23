// Extension point: AI providers (Gemini, OpenAI, Anthropic, ...).
export interface AiProvider {
  readonly name: string;
  generate(input: { prompt: string; tools?: unknown[] }): Promise<{ text: string; toolCalls?: unknown[] }>;
}
export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
