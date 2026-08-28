import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

global.fetch = mocks.fetch as never;
global.URL.createObjectURL = mocks.createObjectURL as never;
global.URL.revokeObjectURL = mocks.revokeObjectURL as never;

import { downloadLessonHandoutPdf } from '../download-handout-pdf';

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('downloadLessonHandoutPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createObjectURL.mockReturnValue('blob:mock');
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { appendChild: vi.fn() },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails closed when a pinned blob path is unavailable instead of regenerating', async () => {
    mocks.fetch.mockResolvedValueOnce(jsonResponse(503, { error: 'Runtime blob delivery is unavailable.' }));

    await expect(downloadLessonHandoutPdf({
      lessonId: '1-1',
      lessonTitle: '看见整门课',
      handoutPdfPath: `/api/course-runtime/blob-assets/${'a'.repeat(64)}`,
    })).rejects.toThrow('Runtime blob delivery is unavailable.');

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.createObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the regeneration fallback for legacy mounted paths', async () => {
    mocks.fetch.mockResolvedValueOnce(jsonResponse(404));
    mocks.fetch.mockResolvedValueOnce(new Response(new Blob(['%PDF-1.4']), { status: 200 }));

    await expect(downloadLessonHandoutPdf({
      lessonId: '1-1',
      lessonTitle: '看见整门课',
      handoutPdfPath: '/course-runtime/lessons/1-1/1-1-handout.pdf',
    })).resolves.toBeUndefined();

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
