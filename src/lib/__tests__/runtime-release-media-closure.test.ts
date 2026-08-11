import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildRuntimeReleaseMediaClosure } from '../runtime-release-media-closure';
import { buildRuntimeReleaseManifest } from '../runtime-release';

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-media-closure-'));
  roots.push(root);
  const mediaRoot = path.join(root, 'lessons', '1-1', 'media');
  await mkdir(mediaRoot, { recursive: true });
  await writeFile(path.join(mediaRoot, 'slides.pdf'), '%PDF');
  await writeFile(path.join(mediaRoot, '1-1-media.md'), [
    '# 媒体链接登记',
    'https://ignored.example/document',
    '',
    '## slides.pdf',
    '- Slides',
    'https://legacy.example/slides',
    '',
    '## missing.mp4',
    '- Missing',
    '',
    '## external.mp3',
    '- External',
    'https://legacy.example/audio',
  ].join('\n'));
  const manifest = await buildRuntimeReleaseManifest(root, {
    releaseId: 'runtime-20260812-a',
    sourceRevision: 'a'.repeat(40),
  });
  return { root, manifest };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('runtime release media closure', () => {
  it('requires every published media resource to be a release object while allowing pending resources', async () => {
    const { root, manifest } = await fixture();
    const closure = await buildRuntimeReleaseMediaClosure({ runtimeRoot: root, manifest });

    expect(closure).toMatchObject({ publishedEntries: 1, legacyFallbackEntries: 1, pendingEntries: 1, failures: 1, ready: false });
    expect(closure.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ filename: 'slides.pdf', state: 'published', objectKey: expect.stringContaining('/slides.pdf') }),
      expect.objectContaining({ filename: 'missing.mp4', state: 'pending' }),
      expect.objectContaining({ filename: 'external.mp3', state: 'external-only' }),
    ]));
    expect(JSON.stringify(closure)).not.toContain('https://legacy.example');
  });
});
