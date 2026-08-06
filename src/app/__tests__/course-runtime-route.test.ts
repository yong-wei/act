import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    mockedReadFile.mockReset();
  });

  it('does not serve removed textbook section markdown', async () => {
    const response = await requestRuntimeAsset([
      'resources',
      'textbooks',
      'dorf-modern-control-systems',
      'sections',
      'ch08-example-0801.md',
    ]);

    expect(response.status).toBe(404);
    expect(mockedReadFile).not.toHaveBeenCalled();
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
      join(
        'course-content',
        'runtime',
        'resources',
        'textbooks',
        'dorf-modern-control-systems',
        'assets',
        'chapter-08',
        'fig-08-01.png',
      )
    ));
  });

  it('does not expose structured textbook v2 records through the raw asset route', async () => {
    const response = await requestRuntimeAsset([
      'resources',
      'textbooks-v2',
      'dorf-modern-control-systems',
      'units.jsonl',
    ]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Asset not found' });
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('does not expose structured textbook v2 records through case or backslash variants', async () => {
    const [caseResponse, backslashResponse] = await Promise.all([
      requestRuntimeAsset(['Resources', 'Textbooks-V2', 'dorf-modern-control-systems', 'anchors.jsonl']),
      requestRuntimeAsset(['resources\\textbooks-v2\\dorf-modern-control-systems\\navigation.json']),
    ]);

    expect(caseResponse.status).toBe(404);
    expect(backslashResponse.status).toBe(404);
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('does not expose textbook retrieval indexes through the raw asset route', async () => {
    const [directResponse, caseResponse, backslashResponse] = await Promise.all([
      requestRuntimeAsset(['resources', 'textbook-hybrid-retrieval', 'bge-m3', 'bodies.utf8']),
      requestRuntimeAsset(['Resources', 'Textbook-Hybrid-Retrieval', 'Bge-M3', 'windows.jsonl']),
      requestRuntimeAsset(['resources\\textbook-hybrid-retrieval\\bge-m3\\metadata.json']),
    ]);

    expect(directResponse.status).toBe(404);
    expect(caseResponse.status).toBe(404);
    expect(backslashResponse.status).toBe(404);
    expect(mockedReadFile).not.toHaveBeenCalled();
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

  it('does not expose private resource governance audit artifacts', async () => {
    const response = await requestRuntimeAsset([
      'resource-governance',
      'resource-field-completion-summary.json',
    ]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Asset not found' });
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('does not expose private resource governance artifacts through encoded leading slashes', async () => {
    const response = await requestRuntimeAsset([
      '/resource-governance',
      'resource-field-completion-summary.json',
    ]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Asset not found' });
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('does not expose private resource governance artifacts through case variants', async () => {
    const response = await requestRuntimeAsset([
      'Resource-Governance',
      'resource-field-completion-summary.json',
    ]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Asset not found' });
    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('does not expose private resource governance artifacts through backslash segments', async () => {
    const response = await requestRuntimeAsset([
      'resource-governance\\resource-field-completion-summary.json',
    ]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Asset not found' });
    expect(mockedReadFile).not.toHaveBeenCalled();
  });
});
