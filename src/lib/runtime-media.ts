export function extractDirectAudioSourceFromPreviewHtml(html: string): string | null {
  const match = html.match(/src\s*:\s*['"](https?:\/\/[^'"]+\.mp3(?:\?[^'"]*)?)['"]/i);
  return match?.[1] ?? null;
}
