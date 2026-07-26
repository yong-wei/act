import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEditorDocument: vi.fn(),
  saveEditorDocument: vi.fn(),
  getPreview: vi.fn(),
  reject: vi.fn(),
  retry: vi.fn(),
  retire: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/course-basis', () => ({
  requireCourseBasisActor: vi.fn(async () => ({ actor: { id: 'teacher-1', role: 'TEACHER' } })),
  courseBasisErrorResponse: vi.fn((error: unknown) => Response.json({
    error: error instanceof Error ? error.message : 'invalid-input',
  }, { status: 400 })),
  getCourseBasisVersionForEditing: mocks.getEditorDocument,
  saveCourseBasisVersionEdit: mocks.saveEditorDocument,
  getCourseBasisVersionExtractionPreview: mocks.getPreview,
  rejectCourseBasisVersion: mocks.reject,
  retryCourseBasisExtraction: mocks.retry,
  retireCourseBasisVersion: mocks.retire,
  deleteCourseBasisVersion: mocks.remove,
}));

const context = { params: Promise.resolve({ versionId: 'version-1' }) };

describe('course-basis version editor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the owner-scoped editor document when mode=editor', async () => {
    mocks.getEditorDocument.mockResolvedValue({
      id: 'version-1',
      contentHash: 'a'.repeat(64),
      markdown: '# Course basis',
      frozen: false,
    });
    const { GET } = await import('../route');

    const response = await GET(new Request('http://localhost/api/teacher/course-bases/versions/version-1?mode=editor'), context);

    expect(response.status).toBe(200);
    expect(mocks.getEditorDocument).toHaveBeenCalledWith(expect.anything(), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      versionId: 'version-1',
    });
    await expect(response.json()).resolves.toMatchObject({ document: { id: 'version-1', frozen: false } });
    expect(mocks.getPreview).not.toHaveBeenCalled();
  });

  it('saves Markdown through expected-content-hash optimistic concurrency', async () => {
    mocks.saveEditorDocument.mockResolvedValue({
      version: { id: 'version-1', contentHash: 'b'.repeat(64) },
      createdSuccessor: false,
    });
    const { PATCH } = await import('../route');
    const request = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedContentHash: 'a'.repeat(64), markdown: '# Basis\n\nContent.' }),
    });

    const response = await PATCH(request, context);

    expect(response.status).toBe(200);
    expect(mocks.saveEditorDocument).toHaveBeenCalledWith(expect.anything(), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      versionId: 'version-1',
      expectedContentHash: 'a'.repeat(64),
      markdown: '# Basis\n\nContent.',
    });
  });

  it('preserves structural leading and trailing whitespace in Markdown edits', async () => {
    mocks.saveEditorDocument.mockResolvedValue({
      version: { id: 'version-1', contentHash: 'b'.repeat(64) },
      createdSuccessor: false,
    });
    const { PATCH } = await import('../route');
    const markdown = '    indented code\\n\\n';
    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedContentHash: 'a'.repeat(64), markdown }),
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.saveEditorDocument).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ markdown }));
  });

  it('rejects primitive PATCH payloads as invalid input', async () => {
    const { PATCH } = await import('../route');
    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('invalid'),
    }), context);

    expect(response.status).toBe(400);
    expect(mocks.saveEditorDocument).not.toHaveBeenCalled();
  });
});
