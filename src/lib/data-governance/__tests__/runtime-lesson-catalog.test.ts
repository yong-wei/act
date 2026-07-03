import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();
let tempProject: string | null = null;

async function createTempProject() {
  tempProject = await mkdtemp(path.join(os.tmpdir(), 'runtime-lesson-catalog-'));
  process.chdir(tempProject);
  await mkdir(path.join(tempProject, 'course-content/authoring/shared'), { recursive: true });
  await writeFile(
    path.join(tempProject, 'course-content/authoring/shared/lesson-id-map.json'),
    JSON.stringify({ entries: [] }),
  );
  vi.resetModules();
  return tempProject;
}

afterEach(async () => {
  process.chdir(originalCwd);
  vi.resetModules();
  if (tempProject) {
    await rm(tempProject, { recursive: true, force: true });
    tempProject = null;
  }
});

describe('runtime lesson catalog audit helper', () => {
  it('treats a missing runtime lesson directory as an empty optional catalog', async () => {
    await createTempProject();
    const { loadAllLessonRuntimeResourceCatalogEntriesForAudit } = await import('../../../../scripts/db/runtime-lesson-catalog');

    await expect(loadAllLessonRuntimeResourceCatalogEntriesForAudit()).resolves.toEqual([]);
  });

  it('loads runtime lesson catalog entries without importing server-only course runtime modules', async () => {
    const project = await createTempProject();
    const lessonDir = path.join(project, 'course-content/runtime/lessons/unit-1');
    await mkdir(path.join(lessonDir, 'media'), { recursive: true });
    await writeFile(
      path.join(lessonDir, 'lesson.json'),
      JSON.stringify({
        lesson_id: 'unit-1',
        title: 'Unit 1',
        card_order: ['kn:one'],
        media_index_source_path: 'course-content/runtime/lessons/unit-1/media/unit-1-media.md',
      }),
    );
    await writeFile(
      path.join(lessonDir, 'graph-overlay.json'),
      JSON.stringify({
        lesson_id: 'unit-1',
        focus_node_ids: ['kn:one'],
        nodes: [{ id: 'kn:one', name: 'Node One' }],
        links: [],
      }),
    );
    await writeFile(path.join(lessonDir, 'unit-1-handout.md'), '# Handout');
    await writeFile(
      path.join(lessonDir, 'media/unit-1-media.md'),
      [
        '# 5-1 媒体链接登记',
        '这一段可能包含手册链接 https://example.test/manual，不应成为媒体 URL。',
        '',
        '## clip.mp4',
        '- Demo clip',
        'https://example.test/clip.mp4',
        '',
        '## unit-1-slides.pdf',
        '- Demo slides',
        'https://example.test/slides.pdf',
        '',
        '# clip.mp4',
        '- Legacy duplicate clip heading',
        '',
        '# unit-1-handout.md',
        '- Handout',
      ].join('\n'),
    );
    const { loadAllLessonRuntimeResourceCatalogEntriesForAudit } = await import('../../../../scripts/db/runtime-lesson-catalog');
    const entries = await loadAllLessonRuntimeResourceCatalogEntriesForAudit();

    expect(entries).toMatchObject([{
      lesson: { lesson_id: 'unit-1', title: 'Unit 1' },
      graphOverlay: {
        lesson_id: 'unit-1',
        focus_node_ids: ['kn:one'],
        card_order: ['kn:one'],
        nodes: [{ id: 'kn:one', name: 'Node One' }],
      },
      handoutPath: '/course-runtime/lessons/unit-1/unit-1-handout.md',
      handoutSourcePath: 'course-content/runtime/lessons/unit-1/unit-1-handout.md',
    }]);
    expect(entries[0]?.mediaResources[0]).toMatchObject({
      id: 'clip',
      title: 'Demo clip',
      filename: 'clip.mp4',
      kind: 'video',
      url: 'https://example.test/clip.mp4',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
    });
    expect(entries[0]?.mediaResources.map((resource) => resource.filename)).toEqual([
      'clip.mp4',
      'unit-1-slides.pdf',
    ]);
    expect(entries[0]?.mediaResources.map((resource) => resource.url)).toEqual([
      'https://example.test/clip.mp4',
      'https://example.test/slides.pdf',
    ]);
    expect(entries[0]?.mediaResources.map((resource) => resource.title)).not.toContain('5-1 媒体链接登记');
  });

  it('propagates corrupted runtime lesson JSON', async () => {
    const project = await createTempProject();
    const lessonDir = path.join(project, 'course-content/runtime/lessons/unit-bad');
    await mkdir(lessonDir, { recursive: true });
    await writeFile(path.join(lessonDir, 'lesson.json'), '{bad-json');

    const { loadAllLessonRuntimeResourceCatalogEntriesForAudit } = await import('../../../../scripts/db/runtime-lesson-catalog');

    await expect(loadAllLessonRuntimeResourceCatalogEntriesForAudit()).rejects.toThrow();
  });
});
