export function extractAITextFromStreamChunk(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('0:')) {
    try {
      return JSON.parse(trimmed.slice(2)) as string;
    } catch {
      return '';
    }
  }

  if (trimmed.startsWith('data: ')) {
    const data = trimmed.slice(6);
    if (data === '[DONE]') {
      return '';
    }

    try {
      const parsed = JSON.parse(data) as { content?: string };
      return parsed.content ?? '';
    } catch {
      return data;
    }
  }

  return '';
}
