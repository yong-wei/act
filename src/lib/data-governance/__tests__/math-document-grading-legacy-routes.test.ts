import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as submissionsPOST } from '@/app/api/teacher/document-grading/submissions/route';
import { POST as approvePOST } from '@/app/api/teacher/document-grading/approve/route';
import { POST as previewPOST } from '@/app/api/teacher/document-grading/writeback-preview/route';

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: vi.fn().mockResolvedValue(null),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('legacy document grading routes', () => {
  it('keeps teacher approval and writeback preview available while retiring submissions', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const submissionsResponse = await submissionsPOST(new Request('https://teacher.example/api/legacy', { method: 'POST', body: '{}' }));
    expect(submissionsResponse.status).toBe(410);
    await expect(submissionsResponse.json()).resolves.toEqual(expect.objectContaining({ error: 'legacy-document-grading-route-disabled' }));

    for (const handler of [approvePOST, previewPOST]) {
      const response = await handler(new Request('https://teacher.example/api/legacy', { method: 'POST', body: '{}' }));
      expect(response.status).toBe(401);
    }
  });
});
