import { TEXTBOOK_READER_MARKDOWN_ANCHOR_PREFIX } from '@/lib/textbook-reader-markdown';

const FRAGMENT_MARKER = new RegExp(
  `\\[\\[${TEXTBOOK_READER_MARKDOWN_ANCHOR_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]+\\]\\]`,
  'g',
);

export function excerptTextbookMarkdown(
  markdown: string,
  options: { title?: string; maxChars?: number } = {},
): string {
  const maxChars = options.maxChars ?? 480;
  const title = options.title?.trim() ?? '';
  const lines = markdown.replace(/\r\n/g, '\n').replace(FRAGMENT_MARKER, '').split('\n');
  const kept: string[] = [];
  let chars = 0;
  let skippedMatchingTitle = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!skippedMatchingTitle && title && /^#{1,3}\s+/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,3}\s+/, '').trim();
      if (heading === title) {
        skippedMatchingTitle = true;
        continue;
      }
    }
    if (!trimmed && kept.length === 0) continue;
    kept.push(line);
    chars += trimmed.length;
    if (chars >= maxChars && (trimmed === '' || kept.length >= 6)) break;
  }

  return kept.join('\n').trim();
}
