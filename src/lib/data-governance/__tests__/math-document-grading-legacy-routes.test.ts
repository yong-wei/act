import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as submissionsPOST } from '@/app/api/teacher/document-grading/submissions/route';
import { POST as approvePOST } from '@/app/api/teacher/document-grading/approve/route';
import { POST as previewPOST } from '@/app/api/teacher/document-grading/writeback-preview/route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('legacy document grading routes', () => {
  it('fail closed with a deprecation response outside the test-only compatibility runtime', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const handler of [submissionsPOST, approvePOST, previewPOST]) {
      const response = await handler(new Request('https://teacher.example/api/legacy', { method: 'POST', body: '{}' }));
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({ error: 'legacy-document-grading-route-disabled' }));
    }
  });
});
