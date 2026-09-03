import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('node:fs/promises', () => ({
  default: mocks,
  access: mocks.access,
  readFile: mocks.readFile,
  readdir: mocks.readdir,
}));

describe('course runtime loader error boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.access.mockReset();
    mocks.readFile.mockReset();
    mocks.readdir.mockReset();
  });

  it('treats a missing runtime lesson directory as an empty optional catalog', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ entries: [] }));
    const missingDirectory = Object.assign(new Error('missing runtime lessons'), { code: 'ENOENT' });
    mocks.readdir.mockRejectedValue(missingDirectory);

    const { loadAllLessonRuntimeResourceCatalogEntries } = await import('@/lib/course-bundle');

    await expect(loadAllLessonRuntimeResourceCatalogEntries()).resolves.toEqual([]);
  });

  it('propagates non-missing runtime lesson directory read errors', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ entries: [] }));
    const permissionDenied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    mocks.readdir.mockRejectedValue(permissionDenied);

    const { loadAllLessonRuntimeResourceCatalogEntries } = await import('@/lib/course-bundle');

    await expect(loadAllLessonRuntimeResourceCatalogEntries()).rejects.toThrow('permission denied');
  });

  it('propagates corrupted runtime lesson id map JSON', async () => {
    mocks.readFile.mockResolvedValue('{not-json');
    mocks.readdir.mockResolvedValue([]);

    const { loadAllLessonRuntimeResourceCatalogEntries } = await import('@/lib/course-bundle');

    await expect(loadAllLessonRuntimeResourceCatalogEntries()).rejects.toThrow();
  });

  it('propagates non-missing lesson JSON access errors', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ entries: [] }));
    mocks.readdir.mockResolvedValue([{
      isDirectory: () => true,
      name: 'unit-permission-denied',
    }]);
    const permissionDenied = Object.assign(new Error('lesson json permission denied'), { code: 'EACCES' });
    mocks.access.mockRejectedValue(permissionDenied);

    const { loadAllLessonRuntimeResourceCatalogEntries } = await import('@/lib/course-bundle');

    await expect(loadAllLessonRuntimeResourceCatalogEntries()).rejects.toThrow('lesson json permission denied');
  });
});
