type AIStreamObject = {
  type?: unknown;
  content?: unknown;
  text?: unknown;
  delta?: unknown;
};

function extractTextFromParsedStreamData(parsed: unknown): string {
  if (typeof parsed === 'string') {
    return parsed;
  }

  if (!parsed || typeof parsed !== 'object') {
    return '';
  }

  const data = parsed as AIStreamObject;
  if (data.type === 'text-delta' && typeof data.delta === 'string') {
    return data.delta;
  }

  if (data.type === 'text' && typeof data.text === 'string') {
    return data.text;
  }

  if (typeof data.content === 'string') {
    return data.content;
  }

  if (typeof data.text === 'string') {
    return data.text;
  }

  return '';
}

export function extractAITextFromStreamLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('0:')) {
    try {
      return extractTextFromParsedStreamData(JSON.parse(trimmed.slice(2)));
    } catch {
      return '';
    }
  }

  if (trimmed.startsWith('data:')) {
    const data = trimmed.replace(/^data:\s*/, '');
    if (!data || data === '[DONE]') {
      return '';
    }

    try {
      return extractTextFromParsedStreamData(JSON.parse(data));
    } catch {
      return data;
    }
  }

  return '';
}

export const extractAITextFromStreamChunk = extractAITextFromStreamLine;

export async function readAITextStream(
  response: Response,
  onText?: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取 AI 响应');
  }

  const decoder = new TextDecoder();
  let content = '';
  let pendingBuffer = '';

  const appendText = (text: string) => {
    if (!text) return;
    content += text;
    onText?.(text);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    pendingBuffer += decoder.decode(value, { stream: true });
    const lines = pendingBuffer.split('\n');
    pendingBuffer = lines.pop() ?? '';

    for (const line of lines) {
      appendText(extractAITextFromStreamLine(line));
    }
  }

  pendingBuffer += decoder.decode();
  if (pendingBuffer) {
    appendText(extractAITextFromStreamLine(pendingBuffer));
  }

  return content;
}
