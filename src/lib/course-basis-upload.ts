export function normalizedUploadMimeType(
  mimeType: string,
  sourceType: 'SEARCHABLE_PDF' | 'MARKDOWN' | 'PLAIN_TEXT',
) {
  const genericMimeTypes = new Set([
    '',
    'application/octet-stream',
    'binary/octet-stream',
    'application/x-binary',
  ]);
  if (!genericMimeTypes.has(mimeType.toLowerCase())) return mimeType;
  if (sourceType === 'SEARCHABLE_PDF') return 'application/pdf';
  return sourceType === 'MARKDOWN' ? 'text/markdown' : 'text/plain';
}
