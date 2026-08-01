import { describe, expect, it } from 'vitest';

import { SubmissionError, uploadIntentSchema } from '@/lib/assignments/submission-domain';
import { submissionErrorResponse } from '@/lib/assignments/submission-route-guards';

const allowedFormats = ['PDF', 'DOC', 'DOCX', 'PPTX', 'PNG', 'JPEG', 'Markdown', '纯文本'];

describe('submission route structured format errors', () => {
  it('returns the allowed format set for domain format errors', async () => {
    const response = submissionErrorResponse(
      new SubmissionError('unsupported-assignment-asset-format', 400),
    );

    await expect(response.json()).resolves.toMatchObject({
      error: 'unsupported-assignment-asset-format',
      metadata: { allowedFormats },
    });
  });

  it('returns the allowed format set when request schema rejects an unsupported MIME', async () => {
    const result = uploadIntentSchema.safeParse({
      fileName: 'answer.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 1024,
      checksum: `sha256:${'a'.repeat(64)}`,
      assetRole: 'ATTACHMENT',
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const response = submissionErrorResponse(result.error);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid-payload',
      metadata: { allowedFormats },
    });
  });
});
