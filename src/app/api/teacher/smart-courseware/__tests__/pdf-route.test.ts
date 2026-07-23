import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { user: { id: 'teacher-1', role: 'TEACHER' } } as { user?: { id: string; role: string } } | null,
  exportPdf: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: vi.fn(async () => mocks.session) }));
vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));
vi.mock('@/lib/smart-courseware', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/smart-courseware')>(),
  exportSmartCoursewarePdf: mocks.exportPdf,
}));

import { POST } from '../publications/[publicationRevisionId]/pdf/route';

const actor = { id: 'teacher-1', role: 'TEACHER' };
const context = { params: Promise.resolve({ publicationRevisionId: 'publication-1' }) };

function post(body: unknown) {
  return POST(new Request('http://localhost/api/teacher/smart-courseware/publications/publication-1/pdf', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), context);
}

describe('smart courseware PDF export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: actor };
    mocks.exportPdf.mockResolvedValue({
      artifactBytes: new Uint8Array([37, 80, 68, 70]),
      artifactHash: 'a'.repeat(64),
    });
  });

  it('exports only the server-authorized immutable publication revision as a private PDF', async () => {
    const response = await post({ idempotencyKey: 'pdf-export-key-1' });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-smart-courseware-publication-revision')).toBe('publication-1');
    expect(mocks.exportPdf).toHaveBeenCalledWith({ marker: 'prisma' }, {
      actor, publicationRevisionId: 'publication-1', idempotencyKey: 'pdf-export-key-1',
    });
  });

  it('rejects a student before invoking the export service', async () => {
    mocks.session = { user: { id: 'student-1', role: 'STUDENT' } };

    expect((await post({ idempotencyKey: 'pdf-export-key-2' })).status).toBe(403);
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });

  it('rejects malformed export input before it can name a draft or preview', async () => {
    expect((await post({ idempotencyKey: 'bad key' })).status).toBe(400);
    expect(mocks.exportPdf).not.toHaveBeenCalled();
  });
});
