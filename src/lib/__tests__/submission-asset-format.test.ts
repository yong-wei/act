import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { matchesDeclaredAssignmentAssetFormat } from '@/lib/assignments/submission-asset-format';

describe('assignment asset content format detection', () => {
  it('recognizes the supported non-archive formats', async () => {
    await expect(matchesDeclaredAssignmentAssetFormat(
      Buffer.from('%PDF-1.7\nEOF'),
      'application/pdf',
    )).resolves.toBe(true);
    await expect(matchesDeclaredAssignmentAssetFormat(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    )).resolves.toBe(true);
    await expect(matchesDeclaredAssignmentAssetFormat(
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      'image/jpeg',
    )).resolves.toBe(true);
    await expect(matchesDeclaredAssignmentAssetFormat(
      Buffer.from('# Markdown\n有效文本', 'utf8'),
      'text/markdown',
    )).resolves.toBe(true);
  });

  it('distinguishes DOCX and PPTX from renamed XLSX archives', async () => {
    const docx = new JSZip();
    docx.file('word/document.xml', '<w:document />');
    const pptx = new JSZip();
    pptx.file('ppt/presentation.xml', '<p:presentation />');
    const xlsx = new JSZip();
    xlsx.file('xl/workbook.xml', '<workbook />');

    await expect(matchesDeclaredAssignmentAssetFormat(
      await docx.generateAsync({ type: 'uint8array' }),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )).resolves.toBe(true);
    await expect(matchesDeclaredAssignmentAssetFormat(
      await pptx.generateAsync({ type: 'uint8array' }),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )).resolves.toBe(true);
    await expect(matchesDeclaredAssignmentAssetFormat(
      await xlsx.generateAsync({ type: 'uint8array' }),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )).resolves.toBe(false);
    await expect(matchesDeclaredAssignmentAssetFormat(
      await xlsx.generateAsync({ type: 'uint8array' }),
      'application/pdf',
    )).resolves.toBe(false);
  });

  it('rejects Office archives whose declared expansion exceeds the scanner budget', async () => {
    const bomb = new JSZip();
    bomb.file('word/document.xml', '0'.repeat(2 * 1024 * 1024));

    await expect(matchesDeclaredAssignmentAssetFormat(
      await bomb.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )).resolves.toBe(false);
  });

  it('rejects binary payloads declared as text', async () => {
    await expect(matchesDeclaredAssignmentAssetFormat(
      Buffer.from([0x61, 0x00, 0x62]),
      'text/plain',
    )).resolves.toBe(false);
  });
});
