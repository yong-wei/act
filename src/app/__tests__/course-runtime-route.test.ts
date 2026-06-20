import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { GET } from '../course-runtime/[...assetPath]/route';

const mockedReadFile = vi.mocked(readFile);

function requestRuntimeAsset(assetPath: string[]) {
  return GET(new Request(`http://localhost/course-runtime/${assetPath.join('/')}`), {
    params: Promise.resolve({ assetPath }),
  });
}

describe('course-runtime asset route', () => {
  it('serves textbook section markdown with a text markdown content type', async () => {
    mockedReadFile.mockResolvedValueOnce(Buffer.from('# Bode 图频域响应示例', 'utf-8'));

    const response = await requestRuntimeAsset([
      'resources',
      'textbooks',
      'dorf-modern-control-systems',
      'sections',
      'ch08-example-0801.md',
    ]);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    await expect(response.text()).resolves.toContain('Bode 图频域响应示例');
    expect(mockedReadFile).toHaveBeenCalledWith(expect.stringContaining(
      'course-content/runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md'
    ));
  });

  it('serves textbook image assets with an image content type', async () => {
    mockedReadFile.mockResolvedValueOnce(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const response = await requestRuntimeAsset([
      'resources',
      'textbooks',
      'dorf-modern-control-systems',
      'assets',
      'chapter-08',
      'fig-08-01.png',
    ]);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(mockedReadFile).toHaveBeenCalledWith(expect.stringContaining(
      'course-content/runtime/resources/textbooks/dorf-modern-control-systems/assets/chapter-08/fig-08-01.png'
    ));
  });

  it('returns 404 when a runtime asset is missing', async () => {
    mockedReadFile.mockRejectedValueOnce(new Error('missing'));

    const response = await requestRuntimeAsset([
      'resources',
      'textbooks',
      'dorf-modern-control-systems',
      'sections',
      'missing.md',
    ]);

    expect(response.status).toBe(404);
  });
});
