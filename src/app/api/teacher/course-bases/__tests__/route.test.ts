import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, getServerAuthSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: { courseBasis: { findMany } } }));

import { GET } from '../route';
import { normalizedUploadMimeType } from '../documents/[documentId]/versions/route';

describe('course-bases list route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
  });

  it.each(['abc', 'Infinity', '1.5'])('returns 400 for invalid pagination value %s', async (offset) => {
    const response = await GET(new Request(`https://act.example/api/teacher/course-bases?offset=${offset}`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid-input' });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('course-basis upload MIME normalization', () => {
  it.each([
    ['application/octet-stream', 'SEARCHABLE_PDF', 'application/pdf'],
    ['binary/octet-stream', 'MARKDOWN', 'text/markdown'],
    ['', 'PLAIN_TEXT', 'text/plain'],
    ['application/pdf', 'SEARCHABLE_PDF', 'application/pdf'],
  ] as const)('normalizes %s for %s', (mimeType, sourceType, expected) => {
    expect(normalizedUploadMimeType(mimeType, sourceType)).toBe(expected);
  });
});
