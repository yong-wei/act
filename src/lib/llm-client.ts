type LlmChatRequest = {
  threadId?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  contextId?: string;
  policy?: string;
};

type LlmChatResponse = {
  threadId: string;
  assistantMessage: string;
  tokensUsed?: number;
};

type LlmSummaryRequest = {
  source: string;
  goals?: string;
};

type LlmSummaryResponse = {
  summary: string;
};

const getLlmBaseUrl = () => process.env.LLM_SERVICE_URL ?? 'http://localhost:7002';

export async function chatWithLlm(
  payload: LlmChatRequest,
): Promise<LlmChatResponse> {
  const response = await fetch(`${getLlmBaseUrl()}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`LLM service error (${response.status})`);
  }

  return response.json();
}

export async function summarizeWithLlm(
  payload: LlmSummaryRequest,
): Promise<LlmSummaryResponse> {
  const response = await fetch(`${getLlmBaseUrl()}/llm/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`LLM service error (${response.status})`);
  }

  return response.json();
}
